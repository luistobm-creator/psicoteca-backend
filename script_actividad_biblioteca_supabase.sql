-- ============================================================
-- Actividad de biblioteca (Historial de lectura + Mis descargas)
-- tabla + RLS. Ejecutar en el editor SQL de Supabase.
--
-- Una fila por evento (ver o descargar un documento) -- no se deduplica: es
-- un historial cronologico, como el historial de un navegador.
-- ============================================================

create table if not exists public.actividad_biblioteca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_path text,
  item_mime text,
  item_is_premium boolean not null default false,
  accion text not null,   -- 'vista' | 'descarga'
  created_at timestamptz not null default now()
);

create index if not exists actividad_biblioteca_user_idx
  on public.actividad_biblioteca(user_id, accion, created_at desc);

alter table public.actividad_biblioteca enable row level security;

create policy "select_own_actividad"
  on public.actividad_biblioteca for select
  using (auth.uid() = user_id);

create policy "insert_own_actividad"
  on public.actividad_biblioteca for insert
  with check (auth.uid() = user_id);

-- Sin update/delete: es un registro historico, no se edita ni se borra fila
-- por fila (si en algun momento se quiere "limpiar todo", se agrega aparte).
