import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeLogger, captureException } from "../_shared/sentry.ts";

const MP_API = "https://api.mercadopago.com";

type SupabaseClient = ReturnType<typeof createClient>;

const log = makeLogger("process-pending-payments");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== serviceRoleKey) {
    log("warn", "unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) {
    log("error", "missing_access_token");
    return new Response("Internal Server Error", { status: 500 });
  }

  let reqBody: Record<string, unknown> = {};
  try { reqBody = await req.json(); } catch { /* corpo vazio */ }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  if (reqBody.process_ref) {
    const ref = String(reqBody.process_ref);
    const res = await fetch(
      `${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(ref)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const body = await res.json();
    const approved = (body.results as Array<Record<string, unknown>> | undefined)?.find(p => p.status === "approved");
    if (!approved) {
      return new Response(JSON.stringify({ ok: false, reason: "no_approved_payment_found" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const ok = await processApproved(ref, approved, db);
    return new Response(JSON.stringify({ ok }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Só pega pagamentos criados há mais de 90s para não conflitar com o
  // PaymentReturn polling (que roda por ~60s logo após o pagamento).
  // Cron roda a cada 1 min — isso é a rede de segurança caso a IPN do MP
  // não chegue (ou demore) e o usuário não volte ao site.
  const cutoff = new Date(Date.now() - 90 * 1000).toISOString();

  // Exclui ids do AbacatePay (pix_char_*, bill_*) — esses nunca terão match na busca do MP
  // e ficavam ocupando o LIMIT, impedindo que pagamentos MP mais recentes fossem processados.
  const { data: stale, error: queryErr } = await db
    .from("pending_payments")
    .select("id, user_id, items")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .not("id", "like", "pix_char_%")
    .not("id", "like", "bill_%")
    .order("created_at", { ascending: true })
    .limit(50);

  if (queryErr) {
    log("error", "query_failed", { error: queryErr.message });
    return new Response("Internal Server Error", { status: 500 });
  }

  log("info", "cron_run", { stale_count: stale?.length ?? 0, cutoff });

  if (!stale?.length) {
    return new Response(JSON.stringify({ processed: 0, skipped: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let skipped = 0;
  const debug: Record<string, unknown>[] = [];

  for (const pending of stale) {
    const res = await fetch(
      `${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(pending.id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const body = await res.json();
    const results = (body.results as Array<Record<string, unknown>> | undefined) ?? [];
    debug.push({
      external_ref: pending.id,
      http_status: res.status,
      results_count: results.length,
      statuses: results.map(r => r.status),
      mp_error: body.message ?? body.error ?? null,
    });
    const approved = results.find(p => p.status === "approved");

    if (!approved) {
      log("info", "no_approved_payment", { external_ref: pending.id });
      skipped++;
      continue;
    }

    const ok = await processApproved(pending.id, approved, db);
    if (ok) processed++;
    else skipped++;
  }

  log("info", "cron_done", { processed, skipped });
  return new Response(JSON.stringify({ processed, skipped, debug }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  } catch (err) {
    captureException("process-pending-payments", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function processApproved(
  externalRef: string,
  payment: Record<string, unknown>,
  db: SupabaseClient,
): Promise<boolean> {
  const method = payment.payment_type_id === "credit_card" ? "Cartão" : "Pix";

  // Atômico: só processa se ainda "pending" — evita race entre cron, IPN e force-check.
  // Grava method junto para o trigger de email ter essa informação disponível.
  const { data: updated, error: updateErr } = await db
    .from("pending_payments")
    .update({ status: "completed", method })
    .eq("id", externalRef)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    log("info", "already_processed_or_not_found", { external_ref: externalRef });
    return false;
  }

  const items = updated.items as Array<{ id: string; title: string; price: number }>;

  const { data: dbProducts } = await db
    .from("products")
    .select("id, title, price")
    .in("id", items.map(i => i.id));

  const dbMap = new Map((dbProducts || []).map(p => [p.id as string, p]));
  const rows = items.map(item => {
    const prod = dbMap.get(item.id);
    return {
      user_id: updated.user_id,
      product_id: item.id,
      product_title: prod?.title ?? item.title,
      price: prod?.price ?? item.price,
      method,
    };
  });

  const { error: purchaseErr } = await db.from("purchases").insert(rows);
  if (purchaseErr) {
    log("error", "purchase_insert_failed", { external_ref: externalRef, error: purchaseErr.message });
    await db.from("pending_payments").update({ status: "pending" }).eq("id", externalRef);
    return false;
  }

  log("info", "payment_recovered", { external_ref: externalRef, user_id: updated.user_id, items_count: rows.length });

  // Email disparado pelo trigger fn_email_purchase_confirmed no banco (pending_payments UPDATE).

  return true;
}
