-- Patch 13: trigger de email de confirmação de biblioteca
-- Dispara quando pending_payments.status muda para 'completed'.
-- Garante que o email seja enviado independente do caminho de confirmação
-- (IPN, cron, admin, etc.).

-- Coluna method armazena o meio de pagamento para o email.
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS method text;

-- Função do trigger — SECURITY DEFINER para acessar auth.users
CREATE OR REPLACE FUNCTION public.fn_email_purchase_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_user_name  text;
BEGIN
  -- Só dispara na transição pending → completed (não em reversões ou reprocessamentos)
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN

    SELECT
      u.email,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
    INTO v_user_email, v_user_name
    FROM auth.users u
    WHERE u.id = NEW.user_id;

    IF v_user_email IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/send-email',
      headers := json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body    := json_build_object(
        'to',       v_user_email,
        'subject',  'Seus resumos estão liberados! 📚',
        'template', 'purchase',
        'data',     json_build_object(
          'name',   v_user_name,
          'email',  v_user_email,
          'items',  NEW.items,
          'method', COALESCE(NEW.method, 'Mercado Pago')
        )
      )::jsonb
    );

  END IF;
  RETURN NEW;
END;
$$;

-- Trigger na tabela (AFTER UPDATE para ter acesso a OLD e NEW)
DROP TRIGGER IF EXISTS trg_email_purchase_confirmed ON public.pending_payments;
CREATE TRIGGER trg_email_purchase_confirmed
  AFTER UPDATE ON public.pending_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_email_purchase_confirmed();
