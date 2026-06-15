-- Patch 11: Corrige triggers de email do suporte
-- Aplicado via Supabase MCP em 2026-06-15
--
-- Problema: current_setting('app.supabase_url') retornava null (ALTER DATABASE bloqueado
--           no ambiente gerenciado do Supabase), causando NOT NULL violation no pg_net.
--
-- Solução:
--   1. Tabela _app_secrets: armazena service_role_key; só service_role + SECURITY DEFINER
--      podem ler/escrever. Populada pelo Edge Function bootstrap-service-key (one-time).
--   2. URL hardcoded nos triggers (não é dado sensível).
--   3. Todos os net.http_post envoltos em EXCEPTION para não travar INSERT do ticket.
--   4. Adiciona trigger trg_email_ticket_resolved (chamado finalizado) — faltava no banco.
-- =============================================================================

-- 1. Tabela de secrets (só service_role e funções SECURITY DEFINER acessam)
CREATE TABLE IF NOT EXISTS public._app_secrets (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

REVOKE ALL ON public._app_secrets FROM PUBLIC;
REVOKE ALL ON public._app_secrets FROM anon;
REVOKE ALL ON public._app_secrets FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public._app_secrets TO service_role;

-- 2. fn_email_ticket_opened
CREATE OR REPLACE FUNCTION fn_email_ticket_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url         text := 'https://tlaoalfnzykrdwwlvmpq.supabase.co';
  v_key         text;
  v_admin_email text := 'larissaferreira.sjn@gmail.com';
  v_email       text;
  v_name        text;
  v_label       text;
  v_html_user   text;
  v_html_admin  text;
BEGIN
  SELECT value INTO v_key FROM public._app_secrets WHERE key = 'service_role_key';

  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN
    v_email := NEW.email;
    v_name  := split_part(NEW.email, '@', 1);
  END IF;

  v_label := CASE NEW.subject
    WHEN 'duvida'    THEN 'Duvida sobre o conteudo'
    WHEN 'problema'  THEN 'Problema tecnico'
    WHEN 'pagamento' THEN 'Pagamento'
    WHEN 'acesso'    THEN 'Acesso ao resumo'
    ELSE 'Outro'
  END;

  v_html_user := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;"><table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;"><tr><td align="center"><table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">resumosmed</span></td></tr><tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;"><h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Recebemos sua mensagem</h2><p>Ola, %s. Sua solicitacao foi registrada. Responderemos pelo seu email em ate 2 dias uteis.</p><div style="background:#f5f3ef;border-left:3px solid #E84A6B;padding:16px 20px;margin:20px 0;"><div style="font-size:11px;color:#9a9690;margin-bottom:6px;">%s</div><div style="font-size:14px;">%s</div></div><div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver minha conta</a></div></td></tr></table></td></tr></table></body></html>',
    v_name, v_label,
    left(NEW.message, 400) || CASE WHEN length(NEW.message) > 400 THEN '...' ELSE '' END
  );

  BEGIN
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
      body    := jsonb_build_object('to', v_email, 'subject', 'Recebemos sua solicitacao - resumosmed', 'html', v_html_user)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email_ticket_opened user: %', SQLERRM;
  END;

  v_html_admin := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;"><table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;"><tr><td align="center"><table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:#1B1A17;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">resumosmed - Suporte</span></td></tr><tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;"><h2 style="margin:0 0 16px;font-size:22px;font-weight:700;">Novo chamado</h2><p><strong>%s</strong> - %s</p><p><strong>Assunto:</strong> %s</p><div style="background:#f5f3ef;border-left:3px solid #E84A6B;padding:14px 18px;margin:16px 0;font-size:14px;white-space:pre-wrap;">%s</div></td></tr></table></td></tr></table></body></html>',
    v_name, v_email, v_label, NEW.message
  );

  BEGIN
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
      body    := jsonb_build_object('to', v_admin_email, 'subject', '[Novo chamado] ' || v_label || ' - ' || v_email, 'html', v_html_admin)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email_ticket_opened admin: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_opened ON support_tickets;
CREATE TRIGGER trg_email_ticket_opened
  AFTER INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_opened();

-- 3. fn_email_ticket_reply
CREATE OR REPLACE FUNCTION fn_email_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url   text := 'https://tlaoalfnzykrdwwlvmpq.supabase.co';
  v_key   text;
  v_email text;
  v_name  text;
  v_reply text;
  v_html  text;
BEGIN
  IF NOT NEW.is_admin THEN RETURN NEW; END IF;

  SELECT value INTO v_key FROM public._app_secrets WHERE key = 'service_role_key';

  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM support_tickets t
  JOIN profiles p ON p.id = t.user_id
  WHERE t.id = NEW.ticket_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  v_reply := replace(NEW.message, E'\n', '<br>');

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;"><table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;"><tr><td align="center"><table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">resumosmed</span></td></tr><tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;"><h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Resposta do suporte</h2><p>Ola, %s. Temos uma resposta para o seu chamado.</p><div style="background:#f5f3ef;border-left:3px solid #E84A6B;padding:16px 20px;margin:20px 0;font-size:14px;">%s</div><div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver minha conta</a></div></td></tr></table></td></tr></table></body></html>',
    v_name, v_reply
  );

  BEGIN
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
      body    := jsonb_build_object('to', v_email, 'subject', 'Resposta do suporte - resumosmed', 'html', v_html)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email_ticket_reply: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_reply ON ticket_replies;
CREATE TRIGGER trg_email_ticket_reply
  AFTER INSERT ON ticket_replies
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_reply();

-- 4. fn_email_ticket_resolved (NOVO — não existia no banco)
CREATE OR REPLACE FUNCTION fn_email_ticket_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url   text := 'https://tlaoalfnzykrdwwlvmpq.supabase.co';
  v_key   text;
  v_email text;
  v_name  text;
  v_html  text;
BEGIN
  IF NEW.status <> 'resolved' OR OLD.status = 'resolved' THEN RETURN NEW; END IF;

  SELECT value INTO v_key FROM public._app_secrets WHERE key = 'service_role_key';

  SELECT p.email, COALESCE(p.name, split_part(p.email,'@',1))
  INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  v_html := format(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,sans-serif;"><table width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 16px;"><tr><td align="center"><table width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:#E84A6B;padding:24px 32px;"><span style="font-size:19px;font-weight:700;color:#fff;">resumosmed</span></td></tr><tr><td style="padding:32px;color:#1B1A17;font-size:15px;line-height:1.65;"><h2 style="margin:0 0 16px;font-size:24px;font-weight:700;">Chamado encerrado</h2><p>Ola, %s. Seu chamado de suporte foi marcado como <strong>resolvido</strong>.</p><p>Esperamos ter ajudado! Se o problema persistir ou tiver uma nova duvida, e so abrir outro ticket pela sua conta.</p><div style="margin:24px 0;"><a href="https://resumosmed.com" style="display:inline-block;background:#E84A6B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Voltar ao site</a></div></td></tr></table></td></tr></table></body></html>',
    v_name
  );

  BEGIN
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
      body    := jsonb_build_object('to', v_email, 'subject', 'Seu chamado foi encerrado - resumosmed', 'html', v_html)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email_ticket_resolved: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_ticket_resolved ON support_tickets;
CREATE TRIGGER trg_email_ticket_resolved
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_email_ticket_resolved();

-- NOTA: popular _app_secrets requer rodar o Edge Function bootstrap-service-key UMA VEZ:
--   curl -X POST https://tlaoalfnzykrdwwlvmpq.supabase.co/functions/v1/bootstrap-service-key \
--     -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
-- O Edge Function foi neutralizado (v3 retorna 410) após uso em 2026-06-15.
