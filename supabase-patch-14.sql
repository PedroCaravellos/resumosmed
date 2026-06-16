-- Patch 14: corrige fn_email_purchase_confirmed e o cron process-pending-payments
-- Bug: ambos usavam current_setting('app.supabase_url') / ('app.service_role_key'),
-- que não existem nessa instância (ERROR: unrecognized configuration parameter).
-- O padrão correto do projeto (usado por fn_email_ticket_opened) é ler a key de
-- public._app_secrets e usar a URL do projeto hardcoded.

CREATE OR REPLACE FUNCTION public.fn_email_purchase_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url         text := 'https://tlaoalfnzykrdwwlvmpq.supabase.co';
  v_key         text;
  v_user_email  text;
  v_user_name   text;
BEGIN
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

    SELECT value INTO v_key FROM public._app_secrets WHERE key = 'service_role_key';
    IF v_key IS NULL THEN
      RAISE WARNING 'fn_email_purchase_confirmed: service_role_key não encontrada em _app_secrets';
      RETURN NEW;
    END IF;

    BEGIN
      PERFORM net.http_post(
        url     := v_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body    := jsonb_build_object(
          'to',       v_user_email,
          'subject',  'Seus resumos estão liberados! 📚',
          'template', 'purchase',
          'data',     jsonb_build_object(
            'name',   v_user_name,
            'email',  v_user_email,
            'items',  NEW.items,
            'method', COALESCE(NEW.method, 'Mercado Pago')
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_email_purchase_confirmed: %', SQLERRM;
    END;

  END IF;
  RETURN NEW;
END;
$$;

-- Reagenda o cron usando a mesma estratégia (_app_secrets em vez de current_setting)
SELECT cron.unschedule('process-pending-payments');

SELECT cron.schedule(
  'process-pending-payments',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://tlaoalfnzykrdwwlvmpq.supabase.co/functions/v1/process-pending-payments',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public._app_secrets WHERE key = 'service_role_key')
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $$
);
