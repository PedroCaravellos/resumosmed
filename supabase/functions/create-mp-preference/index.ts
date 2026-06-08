import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

function log(level: "info" | "warn" | "error" | "fatal", event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), service: "create-mp-preference", event, ...data }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
      },
    });
  }

  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      log("fatal", "missing_access_token", { correlation_id: correlationId });
      return json({ error: "Configuração interna inválida" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      log("warn", "unauthenticated_request", { correlation_id: correlationId });
      return json({ error: "Não autenticado" }, 401);
    }

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) {
      log("warn", "invalid_session", { correlation_id: correlationId, auth_error: authError?.message });
      return json({ error: "Sessão inválida" }, 401);
    }

    const { items, cpf, name, email, completionUrl } = await req.json();
    if (!items?.length) {
      return json({ error: "Carrinho vazio" }, 400);
    }

    const digits = (cpf || "").replace(/\D/g, "");
    if (digits.length !== 11) {
      return json({ error: "CPF inválido" }, 400);
    }

    // Busca preços diretamente do banco — nunca confiar em valores do cliente
    const itemIds = (items as Array<{ id: string }>).map(i => i.id);
    const { data: dbProducts, error: dbProductErr } = await db
      .from("products")
      .select("id, title, price")
      .in("id", itemIds)
      .eq("active", true);

    if (dbProductErr || !dbProducts?.length) {
      log("warn", "products_not_found", { correlation_id: correlationId, user_id: user.id, item_ids: itemIds });
      return json({ error: "Um ou mais produtos não encontrados." }, 400);
    }
    if (dbProducts.length !== itemIds.length) {
      log("warn", "products_mismatch", { correlation_id: correlationId, user_id: user.id, requested: itemIds.length, found: dbProducts.length });
      return json({ error: "Um ou mais produtos não encontrados." }, 400);
    }

    const amount = dbProducts.reduce((s, p) => s + (p.price as number), 0);
    const externalRef = crypto.randomUUID();

    const fallbackUrl = "https://resumosmed.com.br?payment_return=1";
    const backUrl = (completionUrl && completionUrl.startsWith("https://"))
      ? completionUrl
      : fallbackUrl;

    const body: Record<string, unknown> = {
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      items: dbProducts.map(p => ({
        id: p.id,
        title: p.title,
        quantity: 1,
        unit_price: p.price,
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

    // Não logar CPF, email ou tokens — apenas metadados não-sensíveis
    log("info", "mp_preference_request", {
      correlation_id: correlationId,
      user_id: user.id,
      items_count: dbProducts.length,
      amount_brl: amount,
      cpf_provided: true,
      external_ref: externalRef,
    });

    const t0 = Date.now();
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const mpBody = await mpRes.json();
    const duration_ms = Date.now() - t0;

    if (!mpRes.ok || !mpBody.id) {
      log("error", "mp_preference_failed", {
        correlation_id: correlationId,
        user_id: user.id,
        mp_status: mpRes.status,
        mp_error: mpBody.message || mpBody.error || "unknown",
        duration_ms,
      });
      return json({ error: "Falha ao criar preferência. Tente novamente." }, 502);
    }

    log("info", "mp_preference_created", {
      correlation_id: correlationId,
      user_id: user.id,
      preference_id: mpBody.id,
      external_ref: externalRef,
      duration_ms,
    });

    const { error: dbErr } = await db.from("pending_payments").insert({
      id:      externalRef,
      user_id: user.id,
      items:   dbProducts.map(p => ({ id: p.id, title: p.title, price: p.price })),
      amount,
      status:  "pending",
    });

    if (dbErr) {
      log("error", "pending_payment_insert_failed", {
        correlation_id: correlationId,
        user_id: user.id,
        external_ref: externalRef,
        db_error: dbErr.message,
      });
      return json({ error: "Erro ao registrar pagamento. Tente novamente." }, 500);
    }

    const checkoutUrl = mpBody.init_point || mpBody.sandbox_init_point;
    return json({ checkoutUrl, chargeId: externalRef }, 200, correlationId);
  } catch (err) {
    log("fatal", "unhandled_exception", {
      correlation_id: correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});

function json(body: unknown, status = 200, correlationId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  if (correlationId) headers["X-Correlation-Id"] = correlationId;
  return new Response(JSON.stringify(body), { status, headers });
}
