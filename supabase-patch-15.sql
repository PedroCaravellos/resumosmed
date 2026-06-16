-- Patch 15: aperta o cron de recuperacao de pagamentos pendentes.
-- Antes: roda a cada 15 min, so processa pagamentos com mais de 10 min
-- (latencia maxima de ~25 min caso a IPN do Mercado Pago falhe/atrase).
-- Isso fazia a entrega do resumo depender, na pratica, do usuario voltar
-- ao site (PaymentReturn faz force-check via JWT).
-- Agora: roda a cada 1 min, processa pagamentos com mais de 90s (o codigo
-- da function já foi ajustado para esse cutoff). Latencia maxima cai para
-- ~2-3 min, totalmente automatico, sem depender de o usuario voltar.

SELECT cron.unschedule('process-pending-payments');

SELECT cron.schedule(
  'process-pending-payments',
  '* * * * *',
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
