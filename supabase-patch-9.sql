-- Patch 9: Notificação de novo ticket para admin + correção do texto do email de resposta
-- Aplique no SQL Editor do Supabase Dashboard

-- =============================================================================
-- 1. Recriar fn_email_ticket_opened com notificação para admin
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_email_ticket_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url        text := current_setting('app.supabase_url', true);
  v_key        text := current_setting('app.service_role_key', true);
  v_email      text;
  v_name       text;
  v_label      text;
  v_html_user  text;
  v_html_admin text;
  v_admin_email text := 'larissaferreira.sjn@gmail.com';
BEGIN
  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN
    v_email := NEW.email;
    v_name  := split_part(NEW.email, '@', 1);
  END IF;

  v_label := CASE NEW.subject
    WHEN 'duvida'    THEN 'Dúvida sobre o conteúdo'
    WHEN 'problema'  THEN 'Problema técnico'
    WHEN 'pagamento' THEN 'Pagamento'
    WHEN 'acesso'    THEN 'Acesso ao resumo'
    ELSE 'Outro'
  END;

  -- ── Email de confirmação para o usuário ──────────────────────────────────
  v_html_user := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Recebemos sua mensagem 📬</h2>
<p>Olá, %s. Sua solicitação foi registrada. Responderemos pelo seu email em até 2 dias úteis.</p>
<div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9690;margin-bottom:6px;">%s</div>
<div style="font-size:14px;color:#1B1A17;line-height:1.6;">%s</div>
</div>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver minha conta →</a></div>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">resumosmed · Acesso vitalício · Garantia de 7 dias<br>Este email foi enviado para %s.</p>
</td></tr></table></td></tr></table></body></html>',
    v_name, v_label,
    left(NEW.message, 400) || CASE WHEN length(NEW.message) > 400 THEN '…' ELSE '' END,
    v_email
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('to', v_email, 'subject', 'Recebemos sua solicitação — resumosmed', 'html', v_html_user)
  );

  -- ── Notificação para o admin ─────────────────────────────────────────────
  v_html_admin := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#1B1A17;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed — Suporte</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;">Novo chamado de suporte 🎫</h2>
<table style="width:100%%;border-collapse:collapse;margin-bottom:20px;">
<tr><td style="padding:8px 12px;background:#f5f3ef;border-radius:6px 6px 0 0;font-size:11px;font-weight:700;color:#9a9690;text-transform:uppercase;letter-spacing:.08em;">Usuário</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e8e5e0;border-top:none;font-size:14px;"><strong>%s</strong> — %s</td></tr>
<tr><td style="padding:8px 12px;background:#f5f3ef;border-radius:0;font-size:11px;font-weight:700;color:#9a9690;text-transform:uppercase;letter-spacing:.08em;margin-top:8px;">Assunto</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e8e5e0;border-top:none;font-size:14px;">%s</td></tr>
<tr><td style="padding:8px 12px;background:#f5f3ef;font-size:11px;font-weight:700;color:#9a9690;text-transform:uppercase;letter-spacing:.08em;">Mensagem</td></tr>
<tr><td style="padding:12px;border:1px solid #e8e5e0;border-top:none;font-size:14px;line-height:1.65;white-space:pre-wrap;">%s</td></tr>
</table>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Abrir painel admin →</a></div>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;">Responda pelo painel admin em resumosmed.com</p>
</td></tr></table></td></tr></table></body></html>',
    v_name, v_email, v_label, NEW.message
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object(
      'to',      v_admin_email,
      'subject', '[Novo chamado] ' || v_label || ' — ' || v_email,
      'html',    v_html_admin
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_opened ON support_tickets;
CREATE TRIGGER trg_email_ticket_opened
  AFTER INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_opened();


-- =============================================================================
-- 2. Corrigir texto do email de resposta ao usuário
--    Remove "responda pelo site" — agora o canal é só por email / novo chamado
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_email_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url   text := current_setting('app.supabase_url', true);
  v_key   text := current_setting('app.service_role_key', true);
  v_email text;
  v_name  text;
  v_reply text;
  v_html  text;
BEGIN
  IF NOT NEW.is_admin THEN RETURN NEW; END IF;

  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM support_tickets t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.id = NEW.ticket_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  v_reply := replace(NEW.message, E'\n', '<br>');

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Resposta do suporte ✉️</h2>
<p>Olá, %s. Temos uma resposta para o seu chamado de suporte.</p>
<div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;font-size:14px;color:#1B1A17;line-height:1.65;">%s</div>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver minha conta →</a></div>
<p style="font-size:13px;color:#6b6965;">Se precisar de mais ajuda, abra um novo chamado pela sua conta no site.</p>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">resumosmed · Acesso vitalício · Garantia de 7 dias<br>Este email foi enviado para %s.</p>
</td></tr></table></td></tr></table></body></html>',
    v_name, v_reply, v_email
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('to', v_email, 'subject', 'Resposta do suporte — resumosmed', 'html', v_html)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_reply ON ticket_replies;
CREATE TRIGGER trg_email_ticket_reply
  AFTER INSERT ON ticket_replies
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_reply();
