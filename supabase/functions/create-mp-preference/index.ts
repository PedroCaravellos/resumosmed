import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeLogger } from "../_shared/sentry.ts";

const MP_API = "https://api.mercadopago.com";

const log = makeLogger("create-mp-preference");

const ALLOWED_ORIGINS = ["https://resumosmed.com", "https://resumosmed.com.br", "https://www.resumosmed.com", "https://www.resumosmed.com.br"];

function validarCpf(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = s % 11;
  if ((r < 2 ? 0 : 11 - r) !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = s % 11;
  return (r < 2 ? 0 : 11 - r) === +d[10];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const json = (body: unknown, status = 200, correlationId?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,
      "Vary": "Origin",
    };
    if (correlationId) headers["X-Correlation-Id"] = correlationId;
    return new Response(JSON.stringify(body), { status, headers });
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
        "Vary": "Origin",
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

    const { items, cpf, name, email, completionUrl, discount_code: rawCode } = await req.json();
    if (!items?.length) {
      return json({ error: "Carrinho vazio" }, 400);
    }
    const discountCode = (rawCode || "").trim().toUpperCase() || null;

    const digits = (cpf || "").replace(/\D/g, "");
    if (digits.length !== 11 || !validarCpf(digits)) {
      return json({ error: "CPF inválido" }, 400);
    }

    // Busca preços diretamente do banco — nunca confiar em valores do cliente
    // Set garante que duplicatas no carrinho sejam rejeitadas explicitamente
    const itemIds = [...new Set((items as Array<{ id: string }>).map(i => i.id))];
    if (itemIds.length !== items.length) {
      log("warn", "duplicate_items_in_cart", { correlation_id: correlationId, user_id: user.id });
      return json({ error: "Carrinho contém itens duplicados." }, 400);
    }

    const { data: dbProducts, error: dbProductErr } = await db
      .from("products")
      .select("id, title, price, sale_type, sale_value, sale_expires_at")
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

    // Bloqueia recompra enquanto um pagamento dos mesmos itens ainda está em
    // processamento — evita cobrança duplicada caso o usuário volte antes da
    // confirmação (webhook/cron) cair. Janela curta (10min, bem acima do
    // pior caso atual de ~3min) pra não travar quem só abandonou o checkout.
    const PENDING_GUARD_MINUTES = 10;
    const pendingCutoff = new Date(Date.now() - PENDING_GUARD_MINUTES * 60 * 1000).toISOString();
    const { data: openPending } = await db
      .from("pending_payments")
      .select("items")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("created_at", pendingCutoff);

    const pendingItemIds = new Set<string>();
    for (const p of openPending || []) {
      for (const it of (p.items as Array<{ id: string }>)) pendingItemIds.add(it.id);
    }
    const blockedIds = itemIds.filter(id => pendingItemIds.has(id));
    if (blockedIds.length) {
      log("warn", "duplicate_checkout_blocked", { correlation_id: correlationId, user_id: user.id, blocked_ids: blockedIds });
      return json({
        error: "Você já tem um pagamento em processamento para um ou mais itens deste carrinho. Aguarde a confirmação (geralmente leva poucos minutos) antes de tentar novamente.",
        pending_item_ids: blockedIds,
      }, 409);
    }

    // Valida cupom de desconto server-side
    let dcRecord: { type: string; value: number; applies_to: string } | null = null;
    if (discountCode) {
      const { data: dc } = await db
        .from("discount_codes")
        .select("type, value, applies_to, active, starts_at, expires_at, max_uses, uses_count")
        .eq("id", discountCode)
        .maybeSingle();
      const now = new Date();
      const valid = dc && dc.active
        && (!dc.starts_at || new Date(dc.starts_at) <= now)
        && (!dc.expires_at || new Date(dc.expires_at) > now)
        && (dc.max_uses === null || dc.uses_count < dc.max_uses);
      if (valid) dcRecord = { type: dc.type, value: dc.value, applies_to: dc.applies_to };
    }

    // Calcula preço efetivo de cada produto (sale + cupom aplicados server-side)
    function productSalePrice(p: { price: number; sale_type?: string | null; sale_value?: number | null; sale_expires_at?: string | null }): number {
      const now = new Date();
      if (!p.sale_type || p.sale_value == null) return p.price;
      if (p.sale_expires_at && new Date(p.sale_expires_at) <= now) return p.price;
      if (p.sale_type === "percent") return Math.max(0, Math.round(p.price * (1 - p.sale_value / 100)));
      if (p.sale_type === "fixed") return Math.max(0, p.price - p.sale_value);
      return p.price;
    }

    function applyCode(price: number, productId: string): number {
      if (!dcRecord) return price;
      if (dcRecord.applies_to !== "all" && dcRecord.applies_to !== productId) return price;
      if (dcRecord.type === "percent") return Math.max(0, Math.round(price * (1 - dcRecord.value / 100)));
      if (dcRecord.type === "fixed") return Math.max(0, price - dcRecord.value);
      return price;
    }

    type DbProduct = { id: string; title: string; price: number; sale_type?: string | null; sale_value?: number | null; sale_expires_at?: string | null };
    const pricedItems = (dbProducts as DbProduct[]).map(p => ({
      ...p,
      original_price: p.price,
      final_price: applyCode(productSalePrice(p), p.id),
    }));

    const originalAmount = pricedItems.reduce((s, p) => s + p.original_price, 0);
    const amount         = pricedItems.reduce((s, p) => s + p.final_price, 0);
    const discountAmount = originalAmount - amount;

    // Se desconto zerara o valor total: cria compra diretamente sem passar pelo MP
    if (amount === 0) {
      const rows = pricedItems.map(p => ({
        user_id:         user.id,
        product_id:      p.id,
        product_title:   p.title,
        price:           0,
        method:          "Desconto",
        discount_code:   discountCode,
        discount_amount: discountAmount,
      }));
      const { error: freeInsertErr } = await db.from("purchases").insert(rows);
      if (freeInsertErr) {
        log("error", "free_discount_purchase_failed", { correlation_id: correlationId, user_id: user.id, db_error: freeInsertErr.message });
        return json({ error: "Erro ao registrar compra gratuita." }, 500);
      }
      if (discountCode) {
        const { data: dcc } = await db.from("discount_codes").select("uses_count").eq("id", discountCode).single();
        await db.from("discount_codes").update({ uses_count: ((dcc?.uses_count as number) ?? 0) + 1 }).eq("id", discountCode);
      }
      log("info", "free_discount_purchase_created", { correlation_id: correlationId, user_id: user.id, discount_code: discountCode });
      return json({ free: true }, 200, correlationId);
    }

    const externalRef = crypto.randomUUID();

    const ALLOWED_RETURN_HOSTS = ["resumosmed.com", "resumosmed.com.br", "www.resumosmed.com", "www.resumosmed.com.br"];
    const fallbackUrl = "https://resumosmed.com?payment_return=1";
    const backUrl = (() => {
      try {
        const u = new URL(completionUrl || "");
        if (u.protocol === "https:" && ALLOWED_RETURN_HOSTS.includes(u.hostname)) return u.href;
      } catch { /* URL inválida */ }
      return fallbackUrl;
    })();

    const body: Record<string, unknown> = {
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      items: pricedItems.map(p => ({
        id: p.id,
        title: p.title,
        quantity: 1,
        unit_price: p.final_price,
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
      items_count: pricedItems.length,
      amount_brl: amount,
      discount_code: discountCode,
      discount_amount: discountAmount,
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
      id:              externalRef,
      user_id:         user.id,
      items:           pricedItems.map(p => ({ id: p.id, title: p.title, price: p.final_price })),
      amount,
      status:          "pending",
      discount_code:   discountCode,
      discount_amount: discountAmount,
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

