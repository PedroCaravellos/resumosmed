import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ABACATEPAY_API = "https://api.abacatepay.com/v2";

// Retorna o ID de produto do Abacate Pay (prod_xxx), criando se necessário.
// externalId inclui preço para invalidar cache se o preço mudar.
async function ensureAbacateProduct(
  apiKey: string,
  item: { id: string; title: string; price: number }
): Promise<string> {
  const externalId = `${item.id}_${item.price}`;

  // Tenta buscar produto existente
  const listRes = await fetch(
    `${ABACATEPAY_API}/products/list?externalId=${encodeURIComponent(externalId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const listBody = await listRes.json();
  if (listBody.data?.length > 0) {
    return listBody.data[0].id as string;
  }

  // Cria novo produto
  const createRes = await fetch(`${ABACATEPAY_API}/products/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      externalId,
      name: item.title,
      price: item.price * 100, // reais → centavos
      currency: "BRL",
    }),
  });
  const createBody = await createRes.json();
  if (!createBody.data?.id) {
    throw new Error("Falha ao criar produto no Abacate Pay: " + JSON.stringify(createBody));
  }
  return createBody.data.id as string;
}

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
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Sessão inválida" });

    const { items, cpf, name, email, cellphone, completionUrl } = await req.json();
    if (!items?.length) return json({ error: "Carrinho vazio" });

    const digits = (cpf || "").replace(/\D/g, "");
    const taxId = digits.length === 11
      ? `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
      : undefined;

    const amount = (items as Array<{ price: number }>).reduce((s, i) => s + i.price, 0);

    // Garante que cada item existe como produto no Abacate Pay
    const typedItems = items as Array<{ id: string; title: string; price: number }>;
    const abacateIds = await Promise.all(typedItems.map(i => ensureAbacateProduct(apiKey, i)));

    const body: Record<string, unknown> = {
      frequency: "ONE_TIME",
      methods: ["PIX", "CARD"],
      completionUrl: completionUrl || "https://resumosmed.com",
      returnUrl: completionUrl || "https://resumosmed.com",
      items: abacateIds.map(id => ({ id, quantity: 1 })),
    };

    if (taxId && name && email) {
      body.customer = {
        name: name || email,
        email,
        taxId,
        cellphone: cellphone || "(00) 00000-0000",
      };
    }

    console.log("[create-checkout] Enviando:", JSON.stringify(body));

    const abacateRes = await fetch(`${ABACATEPAY_API}/checkouts/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const abacateBody = await abacateRes.json();
    console.log("[create-checkout] Resposta:", JSON.stringify(abacateBody));

    if (!abacateRes.ok || abacateBody.success === false) {
      return json({ error: "Falha ao criar checkout: " + JSON.stringify(abacateBody) });
    }

    const billing = abacateBody.data ?? abacateBody;

    const { error: dbErr } = await db.from("pending_payments").insert({
      id:      billing.id,
      user_id: user.id,
      items:   items,
      amount:  amount,
      status:  "pending",
    });
    if (dbErr) {
      console.error("[create-checkout] DB erro:", dbErr);
      return json({ error: "Erro ao registrar pagamento: " + dbErr.message });
    }

    return json({ checkoutUrl: billing.url, chargeId: billing.id });
  } catch (err) {
    console.error("[create-checkout] Erro inesperado:", err);
    return json({ error: String(err) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
