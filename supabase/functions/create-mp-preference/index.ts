import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Valida autenticação do usuário via service role (evita depender de session refresh do cliente)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" });

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida" });

    const { items, cpf, name, email, completionUrl } = await req.json();
    if (!items?.length) return json({ error: "Carrinho vazio" });

    const digits = (cpf || "").replace(/\D/g, "");
    if (digits.length !== 11) return json({ error: "CPF inválido" });

    const externalRef = crypto.randomUUID();
    const amount = (items as Array<{ price: number }>).reduce((s, i) => s + i.price, 0);

    // Mercado Pago exige HTTPS em back_urls para auto_return funcionar
    const fallbackUrl = "https://resumosmed.com.br?payment_return=1";
    const backUrl = (completionUrl && completionUrl.startsWith("https://"))
      ? completionUrl
      : fallbackUrl;

    const body: Record<string, unknown> = {
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      items: (items as Array<{ id: string; title: string; price: number }>).map(item => ({
        id: item.id,
        title: item.title,
        quantity: 1,
        unit_price: item.price,
        currency_id: "BRL",
      })),
      payer: {
        name: name || email,
        email,
        identification: { type: "CPF", number: digits },
      },
      back_urls: {
        success: backUrl,
        failure: backUrl,
        pending: backUrl,
      },
      auto_return: "approved",
    };

    console.log("[create-mp-preference] Enviando:", JSON.stringify(body));

    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const mpBody = await mpRes.json();
    console.log("[create-mp-preference] Resposta MP:", JSON.stringify(mpBody));

    if (!mpRes.ok || !mpBody.id) {
      return json({ error: "Falha ao criar preferência: " + JSON.stringify(mpBody) });
    }

    const { error: dbErr } = await db.from("pending_payments").insert({
      id:      externalRef,
      user_id: user.id,
      items,
      amount,
      status:  "pending",
    });
    if (dbErr) {
      console.error("[create-mp-preference] DB erro:", dbErr);
      return json({ error: "Erro ao registrar pagamento: " + dbErr.message });
    }

    const checkoutUrl = mpBody.init_point || mpBody.sandbox_init_point;
    return json({ checkoutUrl, chargeId: externalRef });
  } catch (err) {
    console.error("[create-mp-preference] Erro inesperado:", err);
    return json({ error: String(err) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
