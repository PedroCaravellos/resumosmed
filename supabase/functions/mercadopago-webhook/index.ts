import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

type SupabaseClient = ReturnType<typeof createClient>;
type MPPayment = Record<string, unknown>;

function log(level: "info" | "warn" | "error" | "fatal", event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), service: "mercadopago-webhook", event, ...data }));
}

const ALLOWED_ORIGINS = ["https://resumosmed.com", "https://resumosmed.com.br", "https://www.resumosmed.com", "https://www.resumosmed.com.br"];
function corsHeaders(origin: string) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const CORS = corsHeaders(origin);
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

  // ── MODO IPN (legado, sem HMAC) ──
  // Notificações via notification_url na preferência não carregam x-signature.
  // Segurança: verificamos o status diretamente na API do MP com o access_token.
  const xSignature = req.headers.get("x-signature") || "";
  if (!xSignature) {
    const isPaymentIpn = queryTopic === "payment" && !!dataId;
    if (!isPaymentIpn) {
      log("warn", "ipn_ignored", { correlation_id: correlationId, topic: queryTopic, data_id: dataId });
      return new Response("OK", { status: 200 });
    }
    log("info", "ipn_received", { correlation_id: correlationId, data_id: dataId });
    const processing = (async () => { await processPaymentId(dataId, accessToken, db); })();
    processing.catch(err => log("error", "ipn_processing_exception", { correlation_id: correlationId, error: err?.message ?? String(err) }));
    return new Response("OK", { status: 200 });
  }

  // ── MODO DASHBOARD WEBHOOK — verificação HMAC obrigatória ──
  const xRequestId = req.headers.get("x-request-id") || "";
  const sigParts   = Object.fromEntries(
    xSignature.split(",").map(p => p.split("=", 2) as [string, string])
  );
  const receivedHash = sigParts["v1"] || "";

  if (!receivedHash) {
    log("warn", "missing_signature", { correlation_id: correlationId, data_id: dataId });
    return new Response("Forbidden", { status: 401 });
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
    return new Response("Forbidden", { status: 401 });
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
  // Se já completado no banco, verifica se compra foi de fato criada
  const { data: existing } = await db
    .from("pending_payments").select("status, user_id").eq("id", externalRef).maybeSingle();
  if (existing?.status === "completed") {
    const { data: purchases } = await db
      .from("purchases").select("id").eq("user_id", existing.user_id).limit(1);
    if (purchases?.length) return "completed";
    // completed mas sem purchase → reprocessa
    await db.from("pending_payments").update({ status: "pending" }).eq("id", externalRef);
  }

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

  const ok = await processPaymentId(String(approved.id), accessToken, db, approved);
  return ok ? "completed" : "pending";
}

// Processa um pagamento MP pelo ID. Retorna true se a compra foi criada com sucesso.
async function processPaymentId(
  paymentId: string,
  accessToken: string,
  db: SupabaseClient,
  payment?: MPPayment,
): Promise<boolean> {
  if (!payment) {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    payment = await res.json();
  }

  log("info", "payment_status_check", { payment_id: paymentId, status: payment.status, external_ref: payment.external_reference });
  if (payment.status !== "approved") return false;

  const externalRef = payment.external_reference as string;
  if (!externalRef) { log("warn", "missing_external_reference", { payment_id: paymentId }); return false; }

  const method = payment.payment_type_id === "credit_card" ? "Cartão" : "Pix";

  // Atômico: só processa se ainda "pending" — evita race condition entre IPN e force-check.
  // Grava method junto para o trigger de email ter essa informação disponível.
  const { data: updated, error: updateErr } = await db
    .from("pending_payments")
    .update({ status: "completed", method })
    .eq("id", externalRef)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    log("warn", "payment_already_processed_or_not_found", { external_ref: externalRef, db_error: updateErr?.message });
    return false;
  }

  const revert = async (reason: string, meta: Record<string, unknown> = {}) => {
    log("fatal", reason, { external_ref: externalRef, user_id: updated.user_id, ...meta });
    await db.from("pending_payments").update({ status: "pending" }).eq("id", externalRef);
  };

  // Busca produtos pelo ID sem filtrar por active — cliente pagou, deve receber
  // independente de o produto ter sido desativado depois da compra
  const pendingItems = updated.items as Array<{ id: string; title: string; price: number }>;
  const { data: dbProducts, error: validProductsErr } = await db
    .from("products")
    .select("id, title, price")
    .in("id", pendingItems.map(i => i.id));

  if (validProductsErr) {
    await revert("product_lookup_failed", { db_error: validProductsErr.message });
    return false;
  }

  // Se algum produto não existe mais no banco, usa título/preço do pending_payment como fallback
  const dbMap = new Map((dbProducts || []).map(p => [p.id as string, p]));
  const rows = pendingItems.map(item => {
    const prod = dbMap.get(item.id);
    return {
      user_id:       updated.user_id,
      product_id:    item.id,
      product_title: prod?.title ?? item.title,
      price:         prod?.price ?? item.price,
      method,
    };
  });

  if (!rows.length) {
    await revert("no_products_for_purchase");
    return false;
  }

  const { error: purchaseErr } = await db.from("purchases").insert(rows);
  if (purchaseErr) {
    await revert("purchase_insert_failed", { items_count: rows.length, db_error: purchaseErr.message });
    return false;
  }

  log("info", "payment_confirmed", { external_ref: externalRef, user_id: updated.user_id, method, items_count: rows.length });

  // Email disparado pelo trigger fn_email_purchase_confirmed no banco (pending_payments UPDATE).

  return true;
}
