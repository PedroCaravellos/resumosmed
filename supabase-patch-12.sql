-- Patch 12: pg_cron para reprocessar pagamentos pending que não chegaram via IPN
-- Roda a cada 15 minutos; chama a Edge Function process-pending-payments
-- com a service role key para autorização interna.
--
-- Pré-requisito: extensions pg_cron e pg_net habilitadas no projeto Supabase.
-- app.supabase_url e app.service_role_key já usados pelos triggers de email.

SELECT cron.schedule(
  'process-pending-payments',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/process-pending-payments',
      headers := json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )::jsonb,
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $$
);
