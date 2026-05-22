-- ════════════════════════════════════════════════════════════════
-- PATCH 3 — Corrige view user_activity_summary
-- Bug: JOIN entre purchases e access_logs multiplicava os valores
-- (1 compra × 50 logs = sum(price) virava preço × 50)
-- ════════════════════════════════════════════════════════════════

create or replace view public.user_activity_summary as
select
  p.id,
  p.name,
  p.email,
  p.role,
  p.banned,
  p.banned_reason,
  p.created_at,
  coalesce((select count(*) from public.purchases pu where pu.user_id = p.id), 0) as purchase_count,
  coalesce((select sum(price) from public.purchases pu where pu.user_id = p.id), 0) as total_spent,
  coalesce((select count(*) from public.access_logs al where al.user_id = p.id and al.severity = 'high'), 0) as high_events,
  coalesce((select count(*) from public.access_logs al where al.user_id = p.id and al.severity = 'warning'), 0) as warning_events,
  coalesce((select count(*) from public.access_logs al where al.user_id = p.id), 0) as total_events,
  (select max(created_at) from public.access_logs al where al.user_id = p.id) as last_event_at
from public.profiles p;
