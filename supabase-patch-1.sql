-- ════════════════════════════════════════════════════════════════
-- PATCH 1 — Conserta recursão infinita nas policies
-- Rode TUDO isso no SQL Editor (substitui as policies do schema original)
-- ════════════════════════════════════════════════════════════════

-- Função helper SECURITY DEFINER bypassa RLS na checagem de role
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── Refaz as policies de PROFILES ──────────────────────────────
drop policy if exists "profiles: leitura própria" on public.profiles;
drop policy if exists "profiles: admin lê tudo"   on public.profiles;
drop policy if exists "profiles: insert próprio"  on public.profiles;

create policy "profiles: leitura própria"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admin lê tudo"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: insert próprio"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ─── Refaz policies de PRODUCTS ─────────────────────────────────
drop policy if exists "products: leitura pública" on public.products;
drop policy if exists "products: admin gerencia"  on public.products;

create policy "products: leitura pública"
  on public.products for select using (true);

create policy "products: admin gerencia"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Refaz policies de PURCHASES ────────────────────────────────
drop policy if exists "purchases: usuário vê só as próprias"     on public.purchases;
drop policy if exists "purchases: admin vê todas"                on public.purchases;
drop policy if exists "purchases: usuário registra próprias compras" on public.purchases;

create policy "purchases: usuário vê só as próprias"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "purchases: admin vê todas"
  on public.purchases for select
  using (public.is_admin());

create policy "purchases: usuário registra próprias compras"
  on public.purchases for insert
  with check (auth.uid() = user_id);

-- ─── Refaz policies de STORAGE ──────────────────────────────────
drop policy if exists "storage: admin upload"  on storage.objects;
drop policy if exists "storage: admin gerencia" on storage.objects;
drop policy if exists "storage: comprador lê"   on storage.objects;

create policy "storage: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'resumos' and public.is_admin());

create policy "storage: admin gerencia"
  on storage.objects for all
  using (bucket_id = 'resumos' and public.is_admin());

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
-- PATCH 2 (opcional) — Popular catálogo com 26 resumos iniciais
-- Roda só uma vez. Se não quiser, pula essa parte.
-- ════════════════════════════════════════════════════════════════
insert into public.products (id, title, area, price, pages, topics, updated) values
('ic','Insuficiência Cardíaca','cardio',39,42,'{Fração de ejeção,NYHA,ECA/BRA,Sacubitril}','Abr 26'),
('has','Hipertensão Arterial','cardio',39,38,'{Aferição,Crise hipertensiva,Drogas,Alvo PA}','Mar 26'),
('arrit','Arritmias & ECG','cardio',49,56,'{FA,TV,ECG passo-a-passo,BRD/BRE}','Mai 26'),
('iam','Síndromes Coronarianas Agudas','cardio',49,48,'{IAMCSST,IAMSSST,Troponina,Killip}','Abr 26'),
('dpoc','DPOC','pneumo',35,32,'{GOLD,Exacerbação,LABA/LAMA,O₂ domiciliar}','Fev 26'),
('asma','Asma','pneumo',29,28,'{GINA,Crise,Step-up,Corticoide}','Mar 26'),
('tep','Tromboembolismo Pulmonar','pneumo',35,30,'{Wells,D-dímero,Heparina,Trombolítico}','Abr 26'),
('hep','Hepatites Virais','gastro',39,44,'{A/B/C/D/E,Sorologia,Crônica,Cirrose}','Abr 26'),
('drge','DRGE & Úlcera Péptica','gastro',29,26,'{IBP,H. pylori,Endoscopia,Sintomas alarme}','Mar 26'),
('abdagudo','Abdome Agudo','gastro',49,50,'{Inflamatório,Obstrutivo,Perfurativo,Vascular}','Mai 26'),
('dm','Diabetes Mellitus','endo',59,60,'{DM1 vs DM2,HbA1c,Insulinas,Complicações}','Mai 26'),
('tireoide','Tireoide','endo',35,36,'{Hipo/Hiper,Nódulo,Graves,Hashimoto}','Mar 26'),
('obesidade','Obesidade & Síndrome Metabólica','endo',29,24,'{IMC,GLP-1,Cirurgia bariátrica,Risco CV}','Fev 26'),
('avc','AVC Isquêmico & Hemorrágico','neuro',49,46,'{NIHSS,Trombólise,Janela,HSA}','Abr 26'),
('cefaleia','Cefaleias','neuro',29,22,'{Migrânea,Tensional,Cluster,Sinais alarme}','Fev 26'),
('epilepsia','Epilepsia & Crises','neuro',35,30,'{Focal,Generalizada,Status,Drogas}','Mar 26'),
('ira','Lesão Renal Aguda','nefro',35,28,'{KDIGO,Pré/Renal/Pós,Diálise,Eletrólitos}','Mar 26'),
('drc','Doença Renal Crônica','nefro',35,32,'{TFG,Estágios,Anemia,Hiperparat.}','Abr 26'),
('sepse','Sepse & Choque Séptico','infecto',39,36,'{qSOFA,Lactato,Bundle 1h,Vasopressor}','Mai 26'),
('tb','Tuberculose','infecto',35,30,'{RIPE,Latente,Resistência,BCG}','Mar 26'),
('hiv','HIV / AIDS','infecto',39,42,'{TARV,Oportunistas,PrEP,CD4}','Abr 26'),
('imuni','Imunização Infantil','pedia',29,24,'{Calendário PNI,Atrasos,Eventos,Contra-indic.}','Fev 26'),
('diarreia','Diarreia Aguda em Pediatria','pedia',29,20,'{TRO,Desidratação,Antibiótico,Zinco}','Mar 26'),
('prenatal','Pré-natal','go',39,38,'{Consultas,Exames,Suplementação,Risco}','Abr 26'),
('climat','Climatério & Menopausa','go',29,22,'{TRH,Osteoporose,Sintomas,Câncer}','Fev 26'),
('trauma','Trauma & ATLS','cirurgia',59,54,'{ABCDE,TCE,Tórax,FAST}','Mai 26')
on conflict (id) do nothing;
