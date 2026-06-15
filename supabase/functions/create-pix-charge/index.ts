import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ABACATEPAY_API = "https://api.abacatepay.com/v2";

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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada");

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Valida autenticação do usuário via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Sessão inválida" });

    const { items, amount, cpf, name, email, cellphone } = await req.json();
    if (!items?.length || !amount || !cpf) {
      return json({ error: "Parâmetros obrigatórios ausentes (items, amount, cpf)" });
    }

    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11 || !validarCpf(digits)) return json({ error: "CPF inválido" });
    const taxId = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;

    // cellphone obrigatório pela API — aceita do frontend ou usa placeholder
    const phone = cellphone || "(00) 00000-0000";

    // Cria cobrança PIX no Abacate Pay
    const body = {
      method: "PIX",
      data: {
        amount: amount * 100, // reais → centavos
        customer: {
          name: name || email,
          taxId,
          email,
          cellphone: phone,
        },
      },
    };

    console.log("[create-pix-charge] Enviando para Abacate Pay:", JSON.stringify(body));

    const abacateRes = await fetch(`${ABACATEPAY_API}/transparents/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const abacateBody = await abacateRes.json();
    console.log("[create-pix-charge] Resposta Abacate Pay:", JSON.stringify(abacateBody));

    if (!abacateRes.ok) {
      console.error("[create-pix-charge] Abacate Pay erro:", abacateBody);
      return json({ error: "Falha ao gerar cobrança PIX: " + JSON.stringify(abacateBody) });
    }

    const charge = abacateBody.data ?? abacateBody;

    // Registra pagamento pendente no banco
    const { error: dbErr } = await db.from("pending_payments").insert({
      id:         charge.id,
      user_id:    user.id,
      items:      items,
      amount:     amount,
      status:     "pending",
      expires_at: charge.expiresAt,
    });
    if (dbErr) {
      console.error("[create-pix-charge] DB erro:", dbErr);
      return json({ error: "Erro ao registrar pagamento: " + dbErr.message });
    }

    return json({
      chargeId:     charge.id,
      brCode:       charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      expiresAt:    charge.expiresAt,
    });
  } catch (err) {
    console.error("[create-pix-charge] Erro inesperado:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
