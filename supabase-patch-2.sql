-- ════════════════════════════════════════════════════════════════
-- PATCH 2 — Logs de atividade + ban de usuários
-- Rode TUDO no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════════

-- 1. Adiciona campo "banned" em profiles
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists banned_at timestamptz;

-- Trigger: cria perfil automaticamente quando usuário se cadastra (recria pra incluir 'banned')
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2. Tabela de logs de atividade do leitor
create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  product_id text references public.products on delete set null,
  event text not null,           -- "open" | "print_screen" | "blur" | "devtools" | "copy" | "print" | "context_menu"
  severity text not null default 'info' check (severity in ('info','warning','high')),
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.access_logs enable row level security;

drop policy if exists "access_logs: usuário insere os próprios" on public.access_logs;
drop policy if exists "access_logs: admin lê tudo" on public.access_logs;

create policy "access_logs: usuário insere os próprios"
  on public.access_logs for insert
  with check (auth.uid() = user_id);

create policy "access_logs: admin lê tudo"
  on public.access_logs for select
  using (public.is_admin());

create index if not exists access_logs_user_idx on public.access_logs(user_id);
create index if not exists access_logs_severity_idx on public.access_logs(severity);
create index if not exists access_logs_created_idx on public.access_logs(created_at desc);

-- 3. Aceite do termo anti-vazamento
create table if not exists public.terms_acceptance (
  user_id uuid primary key references auth.users on delete cascade,
  accepted_at timestamptz not null default now(),
  ip text,
  user_agent text
);

alter table public.terms_acceptance enable row level security;

drop policy if exists "terms: usuário lê o próprio" on public.terms_acceptance;
drop policy if exists "terms: usuário registra próprio" on public.terms_acceptance;
drop policy if exists "terms: admin lê todos" on public.terms_acceptance;

create policy "terms: usuário lê o próprio"
  on public.terms_acceptance for select using (auth.uid() = user_id);

create policy "terms: usuário registra próprio"
  on public.terms_acceptance for insert
  with check (auth.uid() = user_id);

create policy "terms: admin lê todos"
  on public.terms_acceptance for select using (public.is_admin());

-- 4. View agregada pra admin: usuários + atividade suspeita
create or replace view public.user_activity_summary as
select
  p.id,
  p.name,
  p.email,
  p.role,
  p.banned,
  p.banned_reason,
  p.created_at,
  count(distinct pu.id) as purchase_count,
  coalesce(sum(pu.price), 0) as total_spent,
  count(al.id) filter (where al.severity = 'high') as high_events,
  count(al.id) filter (where al.severity = 'warning') as warning_events,
  count(al.id) as total_events,
  max(al.created_at) as last_event_at
from public.profiles p
left join public.purchases pu on pu.user_id = p.id
left join public.access_logs al on al.user_id = p.id
group by p.id;

-- 5. Função pra admin banir usuário (com SECURITY DEFINER pra mexer em profiles de outros)
create or replace function public.admin_set_ban(target_user uuid, ban boolean, reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode banir usuários';
  end if;
  update public.profiles
     set banned = ban,
         banned_reason = case when ban then reason else null end,
         banned_at = case when ban then now() else null end
   where id = target_user;
end;
$$;

revoke all on function public.admin_set_ban from public;
grant execute on function public.admin_set_ban to authenticated;

-- ════════════════════════════════════════════════════════════════
-- ✅ Depois de rodar:
-- • Perfis ganham campo "banned"
-- • Toda atividade suspeita vai pra public.access_logs
-- • Termo aceito fica em public.terms_acceptance
-- • Admin chama supabase.rpc('admin_set_ban', {target_user, ban, reason})
-- ════════════════════════════════════════════════════════════════
