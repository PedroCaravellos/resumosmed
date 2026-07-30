import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const accessToken = Deno.env.get("MERCADOPAGO_SUBSCRIPTION_TOKEN")
    ?? Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")
    ?? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN");
  if (!accessToken) return json({ error: "missing token" }, 500);

  try {
    const body = await req.json();
    console.log("mp-subscription-webhook payload", JSON.stringify(body));

    // MP envia subscription_preapproval (mudança de status) e subscription_authorized_payment (pagamento)
    const { type, data } = body;
    if (!["subscription_preapproval", "subscription_authorized_payment"].includes(type)) {
      return json({ received: true, ignored: true });
    }

    const preapprovalId = data?.id;
    if (!preapprovalId) return json({ error: "missing preapproval id" }, 400);

    // Busca detalhes atualizados do preapproval no MP
    const mpRes = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mpRes.ok) {
      console.error("MP preapproval fetch error", mpRes.status);
      return json({ received: true, error: "mp fetch failed" }, 200);
    }

    const pa = await mpRes.json();
    console.log("preapproval details", JSON.stringify({
      id: pa.id,
      status: pa.status,
      next_payment_date: pa.next_payment_date,
      payer_email: pa.payer_email,
    }));

    const status = pa.status; // authorized | paused | cancelled | pending

    // Mapeia status do MP para nosso enum
    const statusMap: Record<string, string> = {
      authorized: "authorized",
      paused:     "paused",
      cancelled:  "cancelled",
      pending:    "pending",
    };
    const dbStatus = statusMap[status] ?? "pending";

    // Calcula current_period_end:
    // - MP fornece next_payment_date (data da próxima cobrança = fim do período atual)
    // - Se não tiver, estima 1 mês a partir de agora
    const currentPeriodEnd = pa.next_payment_date
      ? new Date(pa.next_payment_date).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updates: Record<string, unknown> = {
      status: dbStatus,
      updated_at: new Date().toISOString(),
    };

    if (dbStatus === "authorized") {
      updates.current_period_end = currentPeriodEnd;
    }

    if (dbStatus === "cancelled") {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error: updateErr } = await db
      .from("subscriptions")
      .update(updates)
      .eq("mp_preapproval_id", preapprovalId);

    if (updateErr) {
      console.error("subscription update error", updateErr.message);
      return json({ received: true, error: "db update failed" }, 200);
    }

    console.log("subscription updated", { preapprovalId, dbStatus, currentPeriodEnd });
    return json({ received: true });
  } catch (err) {
    console.error("mp-subscription-webhook unhandled", err);
    return json({ received: true }, 200); // sempre 200 para o MP não abandonar retentativas
  }
});
