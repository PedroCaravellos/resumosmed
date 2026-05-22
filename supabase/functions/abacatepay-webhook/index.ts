import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[webhook] ABACATEPAY_WEBHOOK_SECRET não configurada");
    return new Response("Internal Server Error", { status: 500 });
  }

  // Lê body como bytes brutos — necessário para HMAC consistente
  const rawBodyBuf = await req.arrayBuffer();
  const rawBodyBytes = new Uint8Array(rawBodyBuf);
  const rawBody = new TextDecoder("utf-8").decode(rawBodyBytes);

  // Verifica assinatura HMAC-SHA256
  const signature = req.headers.get("X-Webhook-Signature");
  if (!signature) {
    console.warn("[webhook] Requisição sem assinatura");
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhookSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  // HMAC sobre os bytes brutos recebidos (não re-codificados)
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, rawBodyBytes);
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  console.log("[webhook] sig recebida:", signature);
  console.log("[webhook] sig esperada:", expectedSig);

  if (signature !== expectedSig) {
    console.warn("[webhook] Assinatura inválida");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { event: string; data: { id: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Responde 200 imediatamente (boa prática: não bloquear o webhook)
  const processing = (async () => {
    const handled = ["transparent.completed", "billing.paid", "checkout.completed"];
    if (!handled.includes(payload.event)) return;

    const chargeId = payload.data?.id;
    if (!chargeId) return;

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca pagamento pendente
    const { data: pending, error: fetchErr } = await db
      .from("pending_payments")
      .select("*")
      .eq("id", chargeId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchErr || !pending) {
      console.warn("[webhook] Pagamento não encontrado ou já processado:", chargeId, fetchErr?.message);
      return;
    }

    // Insere compras na tabela purchases
    const rows = (pending.items as Array<{ id: string; title: string; price: number }>).map(item => ({
      user_id:       pending.user_id,
      product_id:    item.id,
      product_title: item.title,
      price:         item.price,
      method:        "Pix",
    }));

    const { error: purchaseErr } = await db.from("purchases").insert(rows);
    if (purchaseErr) {
      console.error("[webhook] Falha ao inserir purchases:", purchaseErr.message);
      return;
    }

    // Marca pagamento como concluído
    await db.from("pending_payments").update({ status: "completed" }).eq("id", chargeId);
    console.log("[webhook] Pagamento confirmado:", chargeId, "usuário:", pending.user_id);
  })();

  // Não aguarda o processamento — responde 200 na hora
  processing.catch(err => console.error("[webhook] Erro no processamento:", err));

  return new Response("OK", { status: 200 });
});
