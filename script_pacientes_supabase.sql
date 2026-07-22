-- ============================================================
-- Directorio de pacientes — tabla + RLS + enlace ADITIVO con agenda_citas
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
--
-- Importante: el ALTER TABLE al final SOLO agrega una columna nueva y
-- opcional a agenda_citas. No modifica, borra ni migra ninguna fila ni
-- columna existente — las citas que ya tienes (incluida cualquier de
-- prueba) siguen funcionando exactamente igual.
-- ============================================================

create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  edad integer,
  telefono text,
  motivo text,              -- "Motivo / diagnóstico"
  notas text,
  activo boolean not null default true,   -- se archiva (activo=false), nunca se borra de verdad
  created_at timestamptz not null default now()
);

create index if not exists pacientes_user_idx on public.pacientes(user_id);

alter table public.pacientes enable row level security;

create policy "select_own_pacientes"
  on public.pacientes
  for select
  using (auth.uid() = user_id);

create policy "insert_own_pacientes"
  on public.pacientes
  for insert
  with check (auth.uid() = user_id);

create policy "update_own_pacientes"
  on public.pacientes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin política de "delete" a propósito: los pacientes se archivan
-- (activo=false), igual que las citas se cancelan en vez de borrarse.

-- --- Enlace aditivo con agenda_citas (ya existente, en uso) ---------------
alter table public.agenda_citas
  add column if not exists paciente_id uuid references public.pacientes(id) on delete set null;
