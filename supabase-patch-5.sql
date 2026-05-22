-- Adiciona campo de prévia customizável por produto
alter table public.products add column if not exists preview jsonb;
