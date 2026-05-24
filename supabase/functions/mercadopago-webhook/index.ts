import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

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

  const url        = new URL(req.url);
  const queryId    = url.searchParams.get("id") || "";
  const queryTopic = url.searchParams.get("topic") || "";

  const rawBody = await req.text();
  let payload: { type?: string; action?: string; data?: { id?: string } } = {};
  try { if (rawBody) payload = JSON.parse(rawBody); } catch { /* body pode ser vazio */ }

  // Para notification_url: id vem na query string (?id=XXX&topic=payment)
  // Para dashboard webhooks: id vem em payload.data.id
  const dataId = queryId || payload.data?.id || "";

  // Verifica assinatura HMAC-SHA256
  // Formato: x-signature: ts=TIMESTAMP,v1=HASH
  // Manifest: "id:{dataId};request-id:{x-request-id};ts:{ts}"
  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";

  const sigParts = Object.fromEntries(
    xSignature.split(",").map(p => p.split("=", 2) as [string, string])
  );
  const ts           = sigParts["ts"] || "";
  const receivedHash = sigParts["v1"] || "";

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
  const encoder  = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf      = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(manifest));
  const expectedHash = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  console.log("[mp-webhook] sig recebida:", receivedHash);
  console.log("[mp-webhook] sig esperada:", expectedHash);
  console.log("[mp-webhook] manifest:", manifest);

  if (receivedHash && webhookSecret && receivedHash !== expectedHash) {
    console.warn("[mp-webhook] Assinatura inválida");
    return new Response("Unauthorized", { status: 401 });
  }

  // Responde 200 imediatamente; processa em background
  const processing = (async () => {
    const isPaymentEvent = payload.type === "payment"
      || payload.action?.startsWith("payment.")
      || queryTopic === "payment";
    if (!isPaymentEvent) return;

    const paymentId = dataId;
    if (!paymentId) return;

    // Busca detalhes do pagamento no MP
    const payRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await payRes.json();
    console.log("[mp-webhook] Payment status:", payment.status, "ref:", payment.external_reference);

    if (payment.status !== "approved") return;

    const externalRef = payment.external_reference;
    if (!externalRef) {
      console.warn("[mp-webhook] Pagamento sem external_reference:", paymentId);
      return;
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Atualização atômica: só processa se ainda estiver "pending" — evita race condition
    const { data: updated, error: updateErr } = await db
      .from("pending_payments")
      .update({ status: "completed" })
      .eq("id", externalRef)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updateErr || !updated) {
      console.warn("[mp-webhook] Pagamento não encontrado ou já processado:", externalRef, updateErr?.message);
      return;
    }

    const pending = updated;
    const rows = (pending.items as Array<{ id: string; title: string; price: number }>).map(item => ({
      user_id:       pending.user_id,
      product_id:    item.id,
      product_title: item.title,
      price:         item.price,
      method:        payment.payment_type_id === "credit_card" ? "Cartão" : "Pix",
    }));

    const { error: purchaseErr } = await db.from("purchases").insert(rows);
    if (purchaseErr) {
      console.error("[mp-webhook] Falha ao inserir purchases:", purchaseErr.message);
      return;
    }
    console.log("[mp-webhook] Pagamento confirmado:", externalRef, "usuário:", pending.user_id);

    // Email de confirmação de compra — fire-and-forget
    try {
      const { data: { user } } = await db.auth.admin.getUserById(pending.user_id);
      if (user?.email) {
        const name = user.user_metadata?.name || user.email.split("@")[0];
        const items = pending.items as Array<{ title: string; price: number }>;
        const method = payment.payment_type_id === "credit_card" ? "Cartão" : "Pix";
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
    } catch (emailErr) {
      console.warn("[mp-webhook] Falha ao enviar email de confirmação:", emailErr);
    }
  })();

  processing.catch(err => console.error("[mp-webhook] Erro no processamento:", err));

  return new Response("OK", { status: 200 });
});
