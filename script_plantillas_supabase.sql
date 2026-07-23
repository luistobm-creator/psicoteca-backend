-- ============================================================
-- Plantillas de formato -- tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- ============================================================

create table if not exists public.plantillas_formato (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists plantillas_user_idx on public.plantillas_formato(user_id);

alter table public.plantillas_formato enable row level security;

create policy "select_own_plantillas"
  on public.plantillas_formato for select
  using (auth.uid() = user_id);

create policy "insert_own_plantillas"
  on public.plantillas_formato for insert
  with check (auth.uid() = user_id);

create policy "update_own_plantillas"
  on public.plantillas_formato for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own_plantillas"
  on public.plantillas_formato for delete
  using (auth.uid() = user_id);
