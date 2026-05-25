import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

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

  const { error } = await db
    .from("profiles")
    .update({ device_fingerprint: fingerprint, device_name: deviceName })
    .eq("id", user.id);

  if (error) {
    console.error("[save-device-fingerprint] erro:", error.message);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
