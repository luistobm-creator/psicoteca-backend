-- ============================================================
-- Agenda de citas — tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Cada usuario solo puede ver, crear, actualizar y borrar sus propias citas.
--
-- Nota de nombre: se llama "agenda_citas" (no "citas" a secas) para no
-- confundirse con "Citas y referencias APA" (otro término del glosario/menú
-- que en español también usa la palabra "cita", pero con el sentido de
-- referencia bibliográfica).
-- ============================================================

create table if not exists public.agenda_citas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente_nombre text not null,
  tipo_sesion text,
  fecha date not null,
  hora time not null,
  duracion_minutos integer not null default 50,
  modalidad text not null default 'presencial',   -- 'presencial' | 'en_linea'
  recordatorio boolean not null default true,
  estado text not null default 'programada',       -- 'programada' | 'cancelada'
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists agenda_citas_user_fecha_idx on public.agenda_citas(user_id, fecha);

alter table public.agenda_citas enable row level security;

create policy "select_own_citas"
  on public.agenda_citas
  for select
  using (auth.uid() = user_id);

create policy "insert_own_citas"
  on public.agenda_citas
  for insert
  with check (auth.uid() = user_id);

-- A diferencia del glosario, aquí SÍ hace falta "update": reprogramar,
-- cancelar y alternar el recordatorio son actualizaciones, no altas/bajas.
create policy "update_own_citas"
  on public.agenda_citas
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own_citas"
  on public.agenda_citas
  for delete
  using (auth.uid() = user_id);
