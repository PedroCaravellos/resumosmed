import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

type SupabaseClient = ReturnType<typeof createClient>;
type MPPayment = Record<string, unknown>;

function log(level: "info" | "warn" | "error" | "fatal", event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), service: "mercadopago-webhook", event, ...data }));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const correlationId  = req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const webhookSecret  = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  const accessToken    = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) {
    log("fatal", "missing_access_token", { correlation_id: correlationId });
    return new Response("Internal Server Error", { status: 500 });
  }
  if (!webhookSecret) {
    log("fatal", "missing_webhook_secret", { correlation_id: correlationId });
    return new Response("Internal Server Error", { status: 500 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url              = new URL(req.url);
  const queryId          = url.searchParams.get("id") || "";
  const queryTopic       = url.searchParams.get("topic") || "";
  const externalRefQuery = url.searchParams.get("external_reference") || "";

  const rawBody = await req.text();
  let payload: { type?: string; action?: string; data?: { id?: string } } = {};
  try { if (rawBody) payload = JSON.parse(rawBody); } catch { /* body vazio */ }

  const dataId = queryId || payload.data?.id || "";

  // ── MODO FORCE-CHECK: chamado pelo PaymentReturn — exige JWT do usuário ──
  if (externalRefQuery && !dataId) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      log("warn", "force_check_unauthenticated", { correlation_id: correlationId });
      return new Response("Unauthorized", { status: 401, headers: CORS });
    }
    const { data: { user: fcUser }, error: fcAuthErr } = await db.auth.getUser(token);
    if (fcAuthErr || !fcUser) {
      log("warn", "force_check_invalid_session", { correlation_id: correlationId });
      return new Response("Unauthorized", { status: 401, headers: CORS });
    }
    // Verifica ownership: só o dono do pagamento pode forçar o check
    const { data: pendingOwner } = await db
      .from("pending_payments")
      .select("user_id")
      .eq("id", externalRefQuery)
      .maybeSingle();
    if (!pendingOwner || pendingOwner.user_id !== fcUser.id) {
      log("warn", "force_check_forbidden", { correlation_id: correlationId, user_id: fcUser.id, external_ref: externalRefQuery });
      return new Response("Forbidden", { status: 403, headers: CORS });
    }
    const status = await processExternalRef(externalRefQuery, accessToken, db);
    return new Response(JSON.stringify({ status }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // ── MODO IPN / DASHBOARD WEBHOOK — verificação HMAC obrigatória ──
  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  const sigParts   = Object.fromEntries(
    xSignature.split(",").map(p => p.split("=", 2) as [string, string])
  );
  const receivedHash = sigParts["v1"] || "";

  if (!receivedHash) {
    log("warn", "missing_signature", { correlation_id: correlationId, data_id: dataId });
    return new Response("Forbidden", { status: 401, headers: CORS });
  }

  const ts        = sigParts["ts"] || "";
  const manifest  = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
  const encoder   = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf      = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(manifest));
  const expectedHash = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  if (receivedHash !== expectedHash) {
    log("error", "webhook_signature_invalid", { correlation_id: correlationId, data_id: dataId });
    return new Response("Forbidden", { status: 401, headers: CORS });
  }

  // Responde 200 ao MP imediatamente; processa em background
  const processing = (async () => {
    const isPaymentEvent = payload.type === "payment"
      || payload.action?.startsWith("payment.")
      || queryTopic === "payment";
    if (!isPaymentEvent || !dataId) return;
    await processPaymentId(dataId, accessToken, db);
  })();

  processing.catch(err => log("error", "processing_exception", { correlation_id: correlationId, error: err?.message ?? String(err) }));
  return new Response("OK", { status: 200 });
});

// Busca pagamento aprovado pelo external_reference e processa se necessário
async function processExternalRef(externalRef: string, accessToken: string, db: SupabaseClient): Promise<string> {
  // Se já completado no banco, retorna imediatamente
  const { data: existing } = await db
    .from("pending_payments").select("status").eq("id", externalRef).maybeSingle();
  if (existing?.status === "completed") return "completed";

  // Busca no MP por external_reference
  const searchRes  = await fetch(
    `${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchBody = await searchRes.json();
  const approved   = (searchBody.results as MPPayment[] | undefined)
    ?.find(p => p.status === "approved");

  if (!approved) {
    log("info", "no_approved_payment", { external_ref: externalRef });
    return "pending";
  }

  await processPaymentId(String(approved.id), accessToken, db, approved);
  return "completed";
}

// Processa um pagamento MP pelo ID
async function processPaymentId(
  paymentId: string,
  accessToken: string,
  db: SupabaseClient,
  payment?: MPPayment,
) {
  if (!payment) {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    payment = await res.json();
  }

  log("info", "payment_status_check", { payment_id: paymentId, status: payment.status, external_ref: payment.external_reference });
  if (payment.status !== "approved") return;

  const externalRef = payment.external_reference as string;
  if (!externalRef) { log("warn", "missing_external_reference", { payment_id: paymentId }); return; }

  // Atômico: só processa se ainda "pending" — evita race condition entre IPN e force-check
  const { data: updated, error: updateErr } = await db
    .from("pending_payments")
    .update({ status: "completed" })
    .eq("id", externalRef)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    log("warn", "payment_already_processed_or_not_found", { external_ref: externalRef, db_error: updateErr?.message });
    return;
  }

  const method = payment.payment_type_id === "credit_card" ? "Cartão" : "Pix";

  // Valida product_ids contra o banco — garante preços e títulos canônicos
  // Filtra apenas produtos ativos (mesmo que já tenham sido desativados após a compra)
  const pendingItems = updated.items as Array<{ id: string; title: string; price: number }>;
  const { data: validProducts, error: validProductsErr } = await db
    .from("products")
    .select("id, title, price")
    .in("id", pendingItems.map(i => i.id))
    .eq("active", true);

  if (validProductsErr) {
    // Falha de DB: reverte status para "pending" para permitir reprocessamento futuro
    log("fatal", "product_lookup_failed", { external_ref: externalRef, user_id: updated.user_id, db_error: validProductsErr.message });
    await db.from("pending_payments").update({ status: "pending" }).eq("id", externalRef);
    return;
  }

  const validMap = new Map((validProducts || []).map(p => [p.id as string, p]));
  const rows = pendingItems
    .filter(item => validMap.has(item.id))
    .map(item => {
      const prod = validMap.get(item.id)!;
      return {
        user_id:       updated.user_id,
        product_id:    prod.id,
        product_title: prod.title,
        price:         prod.price, // preço do banco
        method,
      };
    });

  if (!rows.length) {
    log("fatal", "no_valid_products_for_purchase", { external_ref: externalRef, user_id: updated.user_id });
    return;
  }

  const { error: purchaseErr } = await db.from("purchases").insert(rows);
  if (purchaseErr) {
    log("fatal", "purchase_insert_failed", {
      external_ref: externalRef,
      user_id: updated.user_id,
      items_count: rows.length,
      db_error: purchaseErr.message,
    });
    return;
  }
  log("info", "payment_confirmed", { external_ref: externalRef, user_id: updated.user_id, method, items_count: rows.length });

  // Email de confirmação — fire-and-forget
  try {
    const { data: { user } } = await db.auth.admin.getUserById(updated.user_id);
    if (user?.email) {
      const name  = user.user_metadata?.name || user.email.split("@")[0];
      const items = updated.items as Array<{ title: string; price: number }>;
      const { htmlPurchase } = await import("../send-email/index.ts");
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          to: user.email,
          subject: "Seus resumos estão liberados! 📚",
          html: htmlPurchase(name, user.email, items, method),
        }),
      });
    }
  } catch (e) { log("warn", "email_send_failed", { external_ref: externalRef, error: (e as Error)?.message }); }
}
