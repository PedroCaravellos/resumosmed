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

  // Validar JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verificar usuário via token dele (anon client)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  // Parsear body
  let body: { product_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const { product_id } = body;
  if (!product_id) return json({ error: "product_id obrigatório" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // Verificar que o produto existe e tem price=0
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, title, price")
    .eq("id", product_id)
    .eq("active", true)
    .single();

  if (prodErr || !product) return json({ error: "Produto não encontrado" }, 404);
  if (product.price !== 0) return json({ error: "Este produto não é gratuito" }, 403);

  // Idempotência: já possui?
  const { data: existing } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", product_id)
    .maybeSingle();

  if (existing) return json({ ok: true, already_owned: true });

  // Conceder acesso
  const { error: insertErr } = await admin
    .from("purchases")
    .insert({
      user_id: user.id,
      product_id: product.id,
      product_title: product.title,
      price: 0,
      method: "Free",
    });

  if (insertErr) return json({ error: insertErr.message }, 500);
  return json({ ok: true });
});
