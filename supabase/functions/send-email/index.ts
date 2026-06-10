// send-email — Edge Function universal para envio de emails via Resend.
// Chamada internamente por outros webhooks e por triggers pg_net.
// Autenticação: service role key no header Authorization.

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "resumosmed <noreply@resumosmed.com>";

// ─── Layout base dos emails ───────────────────────────────────────────────────
function baseTemplate(content: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>resumosmed</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#E84A6B;padding:24px 32px;">
            <span style="font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">✚ resumosmed</span>
          </td>
        </tr>

        <!-- Conteúdo -->
        <tr>
          <td style="padding:32px 32px 24px;color:#1B1A17;font-size:15px;line-height:1.65;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
            <p style="margin:0;font-size:12px;color:#9a9690;line-height:1.6;text-align:center;">
              resumosmed · Acesso vitalício · Garantia de 7 dias<br>
              Este email foi enviado para ${recipientEmail}. Se não foi você, ignore esta mensagem.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Botão CTA ────────────────────────────────────────────────────────────────
function btn(text: string, url: string): string {
  return `<div style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#E84A6B;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">${text}</a>
  </div>`;
}

// ─── Templates de cada email ──────────────────────────────────────────────────
function htmlWelcome(name: string, email: string): string {
  return baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B1A17;">Bem-vindo, ${name}! 🩺</h2>
    <p>Sua conta no <strong>resumosmed</strong> está criada. Agora você tem acesso ao catálogo completo de resumos de medicina — feitos por quem estuda pra quem estuda.</p>
    <p>Explore os resumos por área, adicione ao carrinho e acesse na sua biblioteca sempre que quiser. O acesso é vitalício e as atualizações são gratuitas pra sempre.</p>
    ${btn("Ver catálogo →", "https://resumosmed.com")}
    <p style="font-size:13px;color:#6b6965;">Qualquer dúvida, responda este email ou abra um ticket de suporte na sua conta.</p>
  `, email);
}

function htmlPurchase(name: string, email: string, items: Array<{ title: string; price: number }>, method: string): string {
  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0ede8;font-size:14px;">${i.title}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0ede8;font-size:14px;text-align:right;font-weight:600;">R$&nbsp;${i.price}</td>
    </tr>`
  ).join("");
  const total = items.reduce((s, i) => s + i.price, 0);
  return baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1B1A17;">Seus resumos estão liberados! 📚</h2>
    <p style="margin:0 0 24px;color:#6b6965;">Obrigado pela compra, ${name}. Acesso liberado na hora.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9690;padding-bottom:8px;border-bottom:2px solid #1B1A17;">Resumo</th>
        <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9690;padding-bottom:8px;border-bottom:2px solid #1B1A17;">Valor</th>
      </tr>
      ${itemRows}
      <tr>
        <td style="padding:12px 0 0;font-weight:700;font-size:15px;">Total</td>
        <td style="padding:12px 0 0;font-weight:700;font-size:15px;text-align:right;color:#E84A6B;">R$&nbsp;${total}</td>
      </tr>
    </table>
    <p style="font-size:12px;color:#9a9690;margin:4px 0 24px;">Pagamento via ${method}</p>
    ${btn("Acessar minha biblioteca →", "https://resumosmed.com")}
    <p style="font-size:13px;color:#6b6965;">Dúvida? Abra um ticket de suporte na sua conta ou responda este email.</p>
  `, email);
}

function htmlTicketOpened(name: string, email: string, subject: string, message: string): string {
  const subjectLabels: Record<string, string> = {
    duvida: "Dúvida geral", acesso: "Problema de acesso", reembolso: "Solicitação de reembolso", outro: "Outro assunto"
  };
  return baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B1A17;">Recebemos sua mensagem 📬</h2>
    <p>Olá, ${name}. Sua solicitação foi registrada com sucesso. Nossa equipe vai responder em breve.</p>
    <div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9690;margin-bottom:6px;">${subjectLabels[subject] || subject}</div>
      <div style="font-size:14px;color:#1B1A17;line-height:1.6;">${message.slice(0, 300)}${message.length > 300 ? "…" : ""}</div>
    </div>
    ${btn("Ver minha conta →", "https://resumosmed.com")}
    <p style="font-size:13px;color:#6b6965;">Você receberá um email quando houver uma resposta.</p>
  `, email);
}

function htmlTicketReply(name: string, email: string, adminMessage: string): string {
  return baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B1A17;">Resposta do suporte ✉️</h2>
    <p>Olá, ${name}. Temos uma atualização no seu chamado de suporte.</p>
    <div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;font-size:14px;color:#1B1A17;line-height:1.65;">
      ${adminMessage.replace(/\n/g, "<br>")}
    </div>
    ${btn("Ver conversa completa →", "https://resumosmed.com")}
    <p style="font-size:13px;color:#6b6965;">Você pode responder diretamente pela sua conta no site.</p>
  `, email);
}

function htmlTicketResolved(name: string, email: string): string {
  return baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1B1A17;">Chamado encerrado ✅</h2>
    <p>Olá, ${name}. Seu chamado de suporte foi marcado como <strong>resolvido</strong>.</p>
    <p>Esperamos ter ajudado! Se o problema persistir ou tiver uma nova dúvida, é só abrir outro ticket pela sua conta.</p>
    ${btn("Voltar ao site →", "https://resumosmed.com")}
  `, email);
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "https://resumosmed.com", "Access-Control-Allow-Headers": "authorization,content-type" } });
  }

  // Apenas chamadas internas autorizadas (service role key)
  const callerKey = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || callerKey !== serviceKey) {
    console.error("[send-email] unauthorized call rejected");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!RESEND_KEY) {
    console.error("[send-email] RESEND_API_KEY não configurada");
    return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500 });
  }

  let body: { to: string; subject: string; html: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Missing to, subject or html" }), { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[send-email] Resend error:", JSON.stringify(data));
    return new Response(JSON.stringify({ error: data }), { status: 500 });
  }

  console.log("[send-email] Enviado para:", to, "id:", data.id);
  return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 200 });
});

// Exporta helpers para uso em outros módulos (import via URL relativa)
export { htmlWelcome, htmlPurchase, htmlTicketOpened, htmlTicketReply, htmlTicketResolved };
