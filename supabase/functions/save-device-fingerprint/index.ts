import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey, x-correlation-id",
};

function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), service: "save-device-fingerprint", event, ...data }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado" }, 401);

  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return json({ error: "Sessão inválida" }, 401);

  const { fingerprint, deviceName } = await req.json();
  if (!fingerprint) return json({ error: "fingerprint obrigatório" }, 400);

  // UPDATE condicional atômico: só vincula se device_fingerprint for NULL ou igual ao atual.
  // Elimina a race condition de dois tabs simultâneos no primeiro acesso —
  // apenas um UPDATE ganha; o outro vê rowCount=0 e recebe 403.
  const { data: updated, error } = await db
    .from("profiles")
    .update({ device_fingerprint: fingerprint, device_name: deviceName })
    .eq("id", user.id)
    .or(`device_fingerprint.is.null,device_fingerprint.eq.${fingerprint}`)
    .select("id");

  if (error) {
    log("error", "fingerprint_save_failed", { correlation_id: correlationId, user_id: user.id, db_error: error.message });
    return json({ error: "Erro interno" }, 500);
  }

  if (!updated?.length) {
    // 0 linhas atualizadas = outro dispositivo já está vinculado
    log("warn", "fingerprint_already_bound", { correlation_id: correlationId, user_id: user.id });
    return json({ error: "Dispositivo já vinculado. Contate o suporte para trocar." }, 403);
  }

  log("info", "fingerprint_saved", { correlation_id: correlationId, user_id: user.id });
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
