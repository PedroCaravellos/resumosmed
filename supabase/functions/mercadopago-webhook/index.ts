import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

type SupabaseClient = ReturnType<typeof createClient>;
type MPPayment = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";
  const accessToken   = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) {
    console.error("[mp-webhook] MERCADOPAGO_ACCESS_TOKEN não configurado");
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

  // ── MODO FORCE-CHECK: chamado pelo PaymentReturn para garantir processamento ──
  // Não depende de IPN; busca ativamente o pagamento no MP e processa se aprovado.
  if (externalRefQuery && !dataId) {
    const status = await processExternalRef(externalRefQuery, accessToken, db);
    return new Response(JSON.stringify({ status }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // ── MODO IPN / DASHBOARD WEBHOOK — verificação HMAC opcional ──
  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  const sigParts   = Object.fromEntries(
    xSignature.split(",").map(p => p.split("=", 2) as [string, string])
  );
  const receivedHash = sigParts["v1"] || "";

  if (receivedHash && webhookSecret) {
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
      console.warn("[mp-webhook] Assinatura inválida");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Responde 200 ao MP imediatamente; processa em background
  const processing = (async () => {
    const isPaymentEvent = payload.type === "payment"
      || payload.action?.startsWith("payment.")
      || queryTopic === "payment";
    if (!isPaymentEvent || !dataId) return;
    await processPaymentId(dataId, accessToken, db);
  })();

  processing.catch(err => console.error("[mp-webhook] Erro no processamento:", err));
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
    console.log("[mp-webhook] Nenhum pagamento aprovado para:", externalRef);
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

  console.log("[mp-webhook] Payment status:", payment.status, "ref:", payment.external_reference);
  if (payment.status !== "approved") return;

  const externalRef = payment.external_reference as string;
  if (!externalRef) { console.warn("[mp-webhook] Sem external_reference:", paymentId); return; }

  // Atômico: só processa se ainda "pending" — evita race condition entre IPN e force-check
  const { data: updated, error: updateErr } = await db
    .from("pending_payments")
    .update({ status: "completed" })
    .eq("id", externalRef)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    console.warn("[mp-webhook] Não encontrado ou já processado:", externalRef, updateErr?.message);
    return;
  }

  const method = payment.payment_type_id === "credit_card" ? "Cartão" : "Pix";
  const rows   = (updated.items as Array<{ id: string; title: string; price: number }>).map(item => ({
    user_id:       updated.user_id,
    product_id:    item.id,
    product_title: item.title,
    price:         item.price,
    method,
  }));

  const { error: purchaseErr } = await db.from("purchases").insert(rows);
  if (purchaseErr) {
    console.error("[mp-webhook] Falha ao inserir purchases:", purchaseErr.message);
    return;
  }
  console.log("[mp-webhook] Pagamento confirmado:", externalRef, "usuário:", updated.user_id);

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
  } catch (e) { console.warn("[mp-webhook] Email falhou:", e); }
}
