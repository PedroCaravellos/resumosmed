-- ════════════════════════════════════════════════════════════════
-- PATCH 4 — Status em purchases + view filtrada
-- Prepara o app pra integração com Pagar.me.
-- Rode no SQL Editor.
-- ════════════════════════════════════════════════════════════════

-- 1. Adiciona coluna status (+ gateway_id + paid_at)
alter table public.purchases
  add column if not exists status text not null default 'paid'
    check (status in ('pending','paid','refunded','failed')),
  add column if not exists gateway_id text,
  add column if not exists paid_at timestamptz;

update public.purchases
   set paid_at = created_at
 where paid_at is null and status = 'paid';

-- 2. Recria sales_with_user (DROP + CREATE — não dá pra mudar ordem de coluna com REPLACE)
drop view if exists public.sales_with_user;

create view public.sales_with_user as
select
  pu.id,
  pu.user_id,
  pu.product_id,
  pu.product_title,
  pu.price,
  pu.method,
  pu.status,
  pu.gateway_id,
  pu.created_at,
  pu.paid_at,
  pr.name as user_name,
  pr.email as user_email,
  p.area as product_area
from public.purchases pu
left join public.profiles pr on pr.id = pu.user_id
left join public.products p on p.id = pu.product_id
where pu.status = 'paid';

-- 3. Recria user_activity_summary (agrega só compras pagas)
drop view if exists public.user_activity_summary;

create view public.user_activity_summary as
select
  p.id,
  p.name,
  p.email,
  p.role,
  p.banned,
  p.banned_reason,
  p.created_at,
  coalesce((select count(*)
              from public.purchases pu
             where pu.user_id = p.id and pu.status = 'paid'), 0) as purchase_count,
  coalesce((select sum(price)
              from public.purchases pu
             where pu.user_id = p.id and pu.status = 'paid'), 0) as total_spent,
  coalesce((select count(*) from public.access_logs al
             where al.user_id = p.id and al.severity = 'high'), 0) as high_events,
  coalesce((select count(*) from public.access_logs al
             where al.user_id = p.id and al.severity = 'warning'), 0) as warning_events,
  coalesce((select count(*) from public.access_logs al
             where al.user_id = p.id), 0) as total_events,
  (select max(created_at) from public.access_logs al
    where al.user_id = p.id) as last_event_at
from public.profiles p;

-- 4. Index pra acelerar lookup por status
create index if not exists purchases_status_idx on public.purchases(status);

-- 5. Validação no profile (name <= 200 caracteres pra evitar abuse)
alter table public.profiles
  drop constraint if exists profiles_name_length;
alter table public.profiles
  add constraint profiles_name_length check (length(name) <= 200);
