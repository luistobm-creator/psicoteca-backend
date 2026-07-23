-- ============================================================
-- Buzon de sugerencias: tabla + RLS. Ejecutar en el editor SQL de Supabase.
--
-- Bandeja de salida propia del usuario: escribe y puede borrar su propio
-- envio (retractarse), pero no lo edita -- una sugerencia ya enviada no se
-- "corrige", se borra y se manda una nueva si hace falta.
-- ============================================================

create table if not exists public.sugerencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null default 'otro',  -- 'idea' | 'error' | 'otro'
  mensaje text not null,
  created_at timestamptz not null default now()
);

create index if not exists sugerencias_user_idx
  on public.sugerencias(user_id, created_at desc);

alter table public.sugerencias enable row level security;

create policy "select_own_sugerencias"
  on public.sugerencias for select
  using (auth.uid() = user_id);

create policy "insert_own_sugerencias"
  on public.sugerencias for insert
  with check (auth.uid() = user_id);

create policy "delete_own_sugerencias"
  on public.sugerencias for delete
  using (auth.uid() = user_id);

-- Sin policy de update: ver nota arriba (no se edita, se borra y reenvia).
