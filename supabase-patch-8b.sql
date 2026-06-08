-- Patch 8b: Cron de limpeza de logs
-- Pré-requisito: pg_cron habilitado em Dashboard > Database > Extensions

SELECT cron.schedule(
  'cleanup-old-logs',
  '0 3 * * 0',
  $$
    DELETE FROM error_logs
    WHERE ts < now() - INTERVAL '90 days';

    DELETE FROM pending_payments
    WHERE status = 'expired'
      AND created_at < now() - INTERVAL '30 days';
  $$
);
