import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

const ALLOWED_ORIGINS = [
  "https://resumosmed.com",
  "https://resumosmed.com.br",
  "https://www.resumosmed.com",
  "https://www.resumosmed.com.br",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Permite previews do Vercel durante testes
  try { const u = new URL(origin); return u.hostname.endsWith(".vercel.app") && u.hostname.includes("resumosmed"); } catch { return false; }
}

const PLANS: Record<string, { label: string; amount: number; frequency: number; frequency_type: string }> = {
  monthly: { label: "Plano Mensal – Resumos Medicina", amount: 1,  frequency: 1, frequency_type: "months" },
  annual:  { label: "Plano Anual – Resumos Medicina",  amount: 1,  frequency: 1, frequency_type: "months" },
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowOrigin,
        "Vary": "Origin",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
      },
    });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_SUBSCRIPTION_TOKEN")
      ?? Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")
      ?? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "Configuração interna inválida" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);

    const { plan = "monthly", back_url } = await req.json();
    const planConfig = PLANS[plan];
    if (!planConfig) return json({ error: "Plano inválido" }, 400);

    // Verifica se já tem assinatura ativa
    const { data: existing } = await db
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["authorized", "pending"])
      .maybeSingle();

    if (existing?.status === "authorized") {
      return json({ error: "Você já tem uma assinatura ativa." }, 409);
    }

    // Busca email do perfil
    const { data: profile } = await db
      .from("profiles")
      .select("email, name")
      .eq("id", user.id)
      .maybeSingle();

    const payerEmail = profile?.email ?? user.email ?? "";

    const safeBackUrl = (() => {
      try {
        const u = new URL(back_url || "");
        const isProduction = ["resumosmed.com","resumosmed.com.br","www.resumosmed.com","www.resumosmed.com.br"].includes(u.hostname);
        const isPreview = u.hostname.endsWith(".vercel.app") && u.hostname.includes("resumosmed");
        if (u.protocol === "https:" && (isProduction || isPreview)) return u.href;
      } catch { /* invalid URL */ }
      return "https://resumosmed.com";
    })();

    // Cria preapproval no Mercado Pago
    const mpPayload = {
      reason: planConfig.label,
      auto_recurring: {
        frequency:          planConfig.frequency,
        frequency_type:     planConfig.frequency_type,
        transaction_amount: planConfig.amount,
        currency_id:        "BRL",
      },
      back_url: safeBackUrl,
      payer_email: payerEmail,
      status: "pending",
      notification_url: `${supabaseUrl}/functions/v1/mp-subscription-webhook`,
    };

    let mpRes: Response;
    try {
      mpRes = await fetch(`${MP_API}/preapproval`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mpPayload),
      });
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("MP fetch error", msg);
      return json({ error: `Erro de rede ao contatar MP: ${msg}` }, 502);
    }

    let mpBody: Record<string, unknown>;
    try {
      mpBody = await mpRes.json();
    } catch {
      const rawText = await mpRes.text().catch(() => "");
      console.error("MP non-JSON response", mpRes.status, rawText.slice(0, 500));
      return json({ error: `MP retornou resposta inválida (${mpRes.status}): ${rawText.slice(0, 200)}` }, 502);
    }

    if (!mpRes.ok || !mpBody.id) {
      console.error("MP preapproval error", mpRes.status, mpBody);
      return json({ error: `MP erro ${mpRes.status}: ${JSON.stringify(mpBody)}` }, 502);
    }

    // Cria ou atualiza registro de assinatura pendente
    if (existing?.status === "pending") {
      await db.from("subscriptions").update({
        mp_preapproval_id: mpBody.id,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await db.from("subscriptions").insert({
        user_id:           user.id,
        plan,
        status:            "pending",
        mp_preapproval_id: mpBody.id,
      });
    }

    // Em sandbox, usar sandbox_init_point; em produção, init_point
    const checkoutUrl = mpBody.sandbox_init_point ?? mpBody.init_point;
    return json({ checkoutUrl, preapprovalId: mpBody.id });
  } catch (err) {
    console.error("create-mp-subscription unhandled", err);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
