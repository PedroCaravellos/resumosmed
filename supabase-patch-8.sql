-- Patch 8: Sistema de logging e monitoramento de produção
-- Aplique no SQL Editor do Supabase Dashboard

-- ── Tabela de logs de erro estruturado ────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ts             timestamptz NOT NULL    DEFAULT now(),
  level          text        NOT NULL    CHECK (level IN ('warn', 'error', 'fatal')),
  service        text        NOT NULL,   -- "frontend", "create-mp-preference", "mercadopago-webhook", etc.
  correlation_id text,                  -- X-Correlation-Id para rastreio ponta-a-ponta
  user_id        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  event          text        NOT NULL,  -- ex: "mp_preference_failed", "pdf_load_failed"
  message        text,
  meta           jsonb,                 -- dados adicionais não-sensíveis
  env            text        NOT NULL   DEFAULT 'production'
);

-- Índices para queries frequentes (dashboard admin, busca por correlationId)
CREATE INDEX IF NOT EXISTS error_logs_ts_idx            ON error_logs (ts DESC);
CREATE INDEX IF NOT EXISTS error_logs_level_idx         ON error_logs (level, ts DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_idx          ON error_logs (user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS error_logs_correlation_idx   ON error_logs (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS error_logs_event_idx         ON error_logs (event, ts DESC);

-- RLS: somente admins lêem; Edge Functions inserem via service role (bypass RLS)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read error_logs"
  ON error_logs FOR SELECT
  USING (is_admin());

-- Nenhuma policy de INSERT para usuários — inserts vêm apenas via service role key

-- ── Limpeza agendada (rodar SEPARADO após habilitar pg_cron) ─────────────
-- PASSO 1: Supabase Dashboard → Database → Extensions → ativar "pg_cron"
-- PASSO 2: Rodar o arquivo supabase-patch-8b.sql no SQL Editor

-- ── View para dashboard admin: erros das últimas 24h ─────────────────────
CREATE OR REPLACE VIEW error_summary_24h AS
SELECT
  event,
  level,
  service,
  COUNT(*)                    AS occurrences,
  MAX(ts)                     AS last_seen,
  COUNT(DISTINCT user_id)     AS affected_users,
  COUNT(DISTINCT correlation_id) AS unique_requests
FROM error_logs
WHERE ts > now() - INTERVAL '24 hours'
GROUP BY event, level, service
ORDER BY occurrences DESC;
