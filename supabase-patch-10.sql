-- Patch 10: Segurança — security_invoker nas views + RLS em support_tickets/ticket_replies
-- Aplique no SQL Editor do Supabase Dashboard

-- =============================================================================
-- 1. Views: ativar security_invoker para que as políticas RLS das tabelas
--    subjacentes sejam aplicadas com as permissões do usuário chamador,
--    não do owner da view. Sem isso qualquer usuário autenticado vê todos os dados.
-- =============================================================================
ALTER VIEW public.sales_with_user SET (security_invoker = on);
ALTER VIEW public.user_activity_summary SET (security_invoker = on);


-- =============================================================================
-- 2. support_tickets: habilitar RLS
-- =============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Usuário lê e gerencia apenas seus próprios tickets
DROP POLICY IF EXISTS "support_tickets: usuario gerencia proprios" ON public.support_tickets;
CREATE POLICY "support_tickets: usuario gerencia proprios"
  ON public.support_tickets
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin lê e gerencia todos os tickets
DROP POLICY IF EXISTS "support_tickets: admin gerencia todos" ON public.support_tickets;
CREATE POLICY "support_tickets: admin gerencia todos"
  ON public.support_tickets
  FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());


-- =============================================================================
-- 3. ticket_replies: habilitar RLS
-- =============================================================================
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Usuário: lê respostas de seus próprios tickets; só pode inserir replies não-admin
-- e apenas em seus próprios tickets. Impede is_admin=true por usuários comuns.
DROP POLICY IF EXISTS "ticket_replies: usuario le e responde proprias" ON public.ticket_replies;
CREATE POLICY "ticket_replies: usuario le e responde proprias"
  ON public.ticket_replies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin = false
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Admin pode fazer tudo em qualquer reply
DROP POLICY IF EXISTS "ticket_replies: admin gerencia todos" ON public.ticket_replies;
CREATE POLICY "ticket_replies: admin gerencia todos"
  ON public.ticket_replies
  FOR ALL
  TO authenticated
  USING  (is_admin())
  WITH CHECK (is_admin());
