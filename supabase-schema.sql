-- ════════════════════════════════════════════════════════════════
-- resumed. — schema inicial para Supabase
-- Rode TUDO isso no SQL Editor do projeto Supabase (uma vez)
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Perfis (estende auth.users) ──────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: leitura própria"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admin lê tudo"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "profiles: insert próprio"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger: cria perfil automaticamente quando usuário se cadastra
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 2. Produtos (resumos à venda) ───────────────────────────────
create table if not exists public.products (
  id text primary key,
  title text not null,
  area text not null,
  price integer not null,
  pages integer not null default 0,
  topics text[] not null default '{}',
  updated text,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products: leitura pública"
  on public.products for select using (true);

create policy "products: admin gerencia"
  on public.products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── 3. Compras ──────────────────────────────────────────────────
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  product_id text not null references public.products on delete restrict,
  product_title text not null,
  price integer not null,
  method text not null default 'Pix',
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "purchases: usuário vê só as próprias"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "purchases: admin vê todas"
  on public.purchases for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "purchases: usuário registra próprias compras"
  on public.purchases for insert
  with check (auth.uid() = user_id);

-- Index pra performance
create index if not exists purchases_user_idx on public.purchases(user_id);
create index if not exists purchases_product_idx on public.purchases(product_id);

-- ─── 4. View: vendas com dados do cliente (para admin) ──────────
create or replace view public.sales_with_user as
select
  pu.id,
  pu.user_id,
  pu.product_id,
  pu.product_title,
  pu.price,
  pu.method,
  pu.created_at,
  pr.name as user_name,
  pr.email as user_email,
  p.area as product_area
from public.purchases pu
left join public.profiles pr on pr.id = pu.user_id
left join public.products p on p.id = pu.product_id;

-- ─── 5. Storage bucket para PDFs (privado) ──────────────────────
insert into storage.buckets (id, name, public)
values ('resumos', 'resumos', false)
on conflict (id) do nothing;

-- Só admin faz upload
create policy "storage: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'resumos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "storage: admin gerencia"
  on storage.objects for all
  using (bucket_id = 'resumos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Quem comprou pode ler (validado via signed URL no app)
create policy "storage: comprador lê"
  on storage.objects for select
  using (
    bucket_id = 'resumos' and exists (
      select 1 from public.purchases pu
      join public.products p on p.id = pu.product_id
      where pu.user_id = auth.uid() and p.file_path = name
    )
  );

-- ════════════════════════════════════════════════════════════════
-- DEPOIS DE RODAR ESSE SQL:
-- 1. Vá em Authentication > Users e clique "Add user > Create new user"
--    crie um admin com email/senha (ex: admin@resumed.com / admin123)
-- 2. Vá em Table Editor > profiles, encontre esse user e mude role para 'admin'
-- 3. (Opcional) Authentication > Providers > Email: desabilite "Confirm email"
--    pra testar mais rápido sem precisar confirmar email
-- ════════════════════════════════════════════════════════════════
