import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://resumosmed.com",
  "https://resumosmed.com.br",
  "https://www.resumosmed.com",
  "https://www.resumosmed.com.br",
];

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ valid: false, error: "Não autenticado" }, 401);
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ valid: false, error: "Sessão inválida" }, 401);

  let body: { code?: string; product_id?: string };
  try { body = await req.json(); } catch { return json({ valid: false, error: "Corpo inválido" }, 400); }

  const code = (body.code || "").trim().toUpperCase();
  const productId = body.product_id || null;
  if (!code) return json({ valid: false, error: "Código obrigatório" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: dc, error: dcErr } = await admin
    .from("discount_codes")
    .select("*")
    .eq("id", code)
    .maybeSingle();

  if (dcErr || !dc) return json({ valid: false, error: "Cupom não encontrado" });
  if (!dc.active) return json({ valid: false, error: "Cupom desativado" });

  const now = new Date();
  if (dc.starts_at && new Date(dc.starts_at) > now) return json({ valid: false, error: "Cupom ainda não está ativo" });
  if (dc.expires_at && new Date(dc.expires_at) < now) return json({ valid: false, error: "Cupom expirado" });
  if (dc.max_uses !== null && dc.uses_count >= dc.max_uses) return json({ valid: false, error: "Cupom esgotado" });

  if (dc.applies_to !== "all" && productId && dc.applies_to !== productId) {
    return json({ valid: false, error: "Cupom não é válido para este produto" });
  }
  if (dc.applies_to !== "all" && !productId) {
    return json({ valid: false, error: "Cupom não é válido para este produto" });
  }

  return json({
    valid: true,
    type: dc.type as "percent" | "fixed",
    value: dc.value as number,
    applies_to: dc.applies_to as string,
  });
});
