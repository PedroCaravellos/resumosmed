-- =============================================================================
-- Email Triggers — resumosmed
-- Rodar no SQL Editor do Supabase após configurar RESEND_API_KEY.
-- Requer: extensão pg_net habilitada (Database → Extensions → pg_net).
--
-- ANTES DE RODAR: substitua os dois valores abaixo pelos seus valores reais.
-- =============================================================================

-- Configura as variáveis do projeto (substitua pelos valores reais):
ALTER DATABASE postgres SET app.supabase_url   = 'https://tlaoalfnzykrdwwlvmpq.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'COLE_AQUI_SUA_SERVICE_ROLE_KEY';

-- =============================================================================
-- 1. EMAIL DE BOAS-VINDAS
--    Disparado quando um novo perfil de usuário é criado (role = 'user')
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_email_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url  text := current_setting('app.supabase_url', true);
  v_key  text := current_setting('app.service_role_key', true);
  v_name text := COALESCE(NEW.name, split_part(NEW.email, '@', 1));
  v_html text;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Bem-vindo, %s! 🩺</h2>
<p>Sua conta no <strong>resumosmed</strong> está criada. Agora você tem acesso ao catálogo completo de resumos de medicina — feitos por quem estuda pra quem estuda.</p>
<p>Explore os resumos por área, adicione ao carrinho e acesse na sua biblioteca sempre que quiser. O acesso é vitalício e as atualizações são gratuitas pra sempre.</p>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver catálogo →</a></div>
<p style="font-size:13px;color:#6b6965;">Qualquer dúvida, abra um ticket de suporte na sua conta.</p>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">
resumosmed · Acesso vitalício · Garantia de 7 dias<br>
Este email foi enviado para %s.
</p></td></tr>
</table></td></tr></table></body></html>',
    v_name, NEW.email
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'to',      NEW.email,
      'subject', 'Bem-vindo ao resumosmed! 🩺',
      'html',    v_html
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_welcome ON profiles;
CREATE TRIGGER trg_email_welcome
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_email_welcome();

-- =============================================================================
-- 2. EMAIL: TICKET DE SUPORTE ABERTO
--    Confirmação para o usuário quando ele abre um chamado
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_email_ticket_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url   text := current_setting('app.supabase_url', true);
  v_key   text := current_setting('app.service_role_key', true);
  v_email text;
  v_name  text;
  v_label text;
  v_html  text;
BEGIN
  -- Pega nome e email do perfil do usuário
  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN
    v_email := NEW.email;
    v_name  := split_part(NEW.email, '@', 1);
  END IF;

  v_label := CASE NEW.subject
    WHEN 'duvida'    THEN 'Dúvida geral'
    WHEN 'acesso'    THEN 'Problema de acesso'
    WHEN 'reembolso' THEN 'Solicitação de reembolso'
    ELSE 'Outro assunto'
  END;

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Recebemos sua mensagem 📬</h2>
<p>Olá, %s. Sua solicitação foi registrada com sucesso. Nossa equipe vai responder em breve.</p>
<div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9690;margin-bottom:6px;">%s</div>
<div style="font-size:14px;color:#1B1A17;line-height:1.6;">%s</div>
</div>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver minha conta →</a></div>
<p style="font-size:13px;color:#6b6965;">Você receberá um email quando houver uma resposta.</p>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">
resumosmed · Acesso vitalício · Garantia de 7 dias<br>Este email foi enviado para %s.</p>
</td></tr></table></td></tr></table></body></html>',
    v_name, v_label,
    left(NEW.message, 300) || CASE WHEN length(NEW.message) > 300 THEN '…' ELSE '' END,
    v_email
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('to', v_email, 'subject', 'Recebemos sua mensagem — resumosmed', 'html', v_html)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_opened ON support_tickets;
CREATE TRIGGER trg_email_ticket_opened
  AFTER INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_opened();

-- =============================================================================
-- 3. EMAIL: RESPOSTA DO ADMIN NO TICKET
--    Notifica o usuário quando um admin responde
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
<p>Olá, %s. Temos uma atualização no seu chamado de suporte.</p>
<div style="background:#f5f3ef;border-left:3px solid #E84A6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;font-size:14px;color:#1B1A17;line-height:1.65;">%s</div>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver conversa completa →</a></div>
<p style="font-size:13px;color:#6b6965;">Você pode responder diretamente pela sua conta no site.</p>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">
resumosmed · Acesso vitalício · Garantia de 7 dias<br>Este email foi enviado para %s.</p>
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

-- =============================================================================
-- 4. EMAIL: TICKET RESOLVIDO
--    Notifica o usuário quando o admin marca como resolvido
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_email_ticket_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url   text := current_setting('app.supabase_url', true);
  v_key   text := current_setting('app.service_role_key', true);
  v_email text;
  v_name  text;
  v_html  text;
BEGIN
  IF NEW.status <> 'resolved' OR OLD.status = 'resolved' THEN RETURN NEW; END IF;

  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
<tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">✚ resumosmed</span></td></tr>
<tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;">
<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Chamado encerrado ✅</h2>
<p>Olá, %s. Seu chamado de suporte foi marcado como <strong>resolvido</strong>.</p>
<p>Esperamos ter ajudado! Se o problema persistir ou tiver uma nova dúvida, é só abrir outro ticket pela sua conta.</p>
<div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Voltar ao site →</a></div>
</td></tr>
<tr><td style="padding:18px 32px 24px;border-top:1px solid #e8e5e0;background:#faf9f7;">
<p style="margin:0;font-size:12px;color:#9a9690;text-align:center;line-height:1.6;">
resumosmed · Acesso vitalício · Garantia de 7 dias<br>Este email foi enviado para %s.</p>
</td></tr></table></td></tr></table></body></html>',
    v_name, v_email
  );

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('to', v_email, 'subject', 'Seu chamado foi encerrado — resumosmed', 'html', v_html)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_resolved ON support_tickets;
CREATE TRIGGER trg_email_ticket_resolved
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_resolved();
