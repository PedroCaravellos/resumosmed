-- Tabela para pagamentos PIX pendentes (Abacate Pay)
create table public.pending_payments (
  id          text primary key,           -- ID da transação retornado pelo Abacate Pay
  user_id     uuid not null references auth.users on delete cascade,
  items       jsonb not null,             -- snapshot do carrinho no momento do pagamento
  amount      integer not null,           -- valor em reais
  status      text not null default 'pending' check (status in ('pending','completed','expired')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

alter table public.pending_payments enable row level security;

-- Usuário pode ler e criar seus próprios pagamentos pendentes
create policy "pending_payments: leitura própria"
  on public.pending_payments for select
  using (auth.uid() = user_id);

create policy "pending_payments: insert próprio"
  on public.pending_payments for insert
  with check (auth.uid() = user_id);

-- Index de performance para polling por status
create index if not exists pending_payments_user_idx on public.pending_payments(user_id);
