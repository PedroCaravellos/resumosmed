-- supabase-patch-18.sql — Sistema de assinaturas recorrentes

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan              TEXT        NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled')),
  mp_preapproval_id TEXT        UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas a própria assinatura
CREATE POLICY "subscriptions: usuario ve propria"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin gerencia tudo
CREATE POLICY "subscriptions: admin gerencia tudo"
  ON public.subscriptions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Service role (Edge Functions) pode inserir/atualizar
CREATE POLICY "subscriptions: service role gerencia"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_mp_id_idx   ON public.subscriptions (mp_preapproval_id);
