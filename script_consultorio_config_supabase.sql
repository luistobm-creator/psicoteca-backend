-- ============================================================
-- Configurar consultorio -- tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Una fila por usuario (user_id es la propia llave primaria).
-- ============================================================

create table if not exists public.consultorio_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_consultorio text,
  direccion text,
  telefono text,
  duracion_sesion_default integer not null default 50,
  moneda text not null default 'MXN',
  updated_at timestamptz not null default now()
);

alter table public.consultorio_config enable row level security;

create policy "select_own_config"
  on public.consultorio_config for select
  using (auth.uid() = user_id);

create policy "insert_own_config"
  on public.consultorio_config for insert
  with check (auth.uid() = user_id);

create policy "update_own_config"
  on public.consultorio_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
