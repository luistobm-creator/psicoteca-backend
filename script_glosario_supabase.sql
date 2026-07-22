-- ============================================================
-- Glosario clínico personal — tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Cada usuario solo puede ver, crear y borrar sus propios términos.
-- ============================================================

create table if not exists public.glosario_clinico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  termino text not null,
  definicion text not null,
  categoria text,
  created_at timestamptz not null default now()
);

create index if not exists glosario_clinico_user_id_idx on public.glosario_clinico(user_id);

alter table public.glosario_clinico enable row level security;

create policy "select_own_terms"
  on public.glosario_clinico
  for select
  using (auth.uid() = user_id);

create policy "insert_own_terms"
  on public.glosario_clinico
  for insert
  with check (auth.uid() = user_id);

-- Sin política de "delete" el endpoint DELETE del backend no borraría nada
-- (RLS bloquea por defecto); la agregamos aunque el pedido original solo
-- mencionara "leer y crear", porque el ciclo completo incluye borrar.
create policy "delete_own_terms"
  on public.glosario_clinico
  for delete
  using (auth.uid() = user_id);
