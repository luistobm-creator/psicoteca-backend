-- ============================================================
-- Tareas terapéuticas — tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Cada usuario solo puede ver, crear, actualizar y borrar sus propias tareas.
-- ============================================================

create table if not exists public.tareas_terapeuticas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'ejercicio',     -- 'ejercicio' | 'lectura' | 'registro'
  descripcion text,
  fecha_limite date,                          -- opcional: no toda tarea tiene fecha límite
  estado text not null default 'pendiente',   -- 'pendiente' | 'completada' | 'cancelada'
  completed_at timestamptz,                   -- la fija el backend, nunca el cliente
  created_at timestamptz not null default now()
);

create index if not exists tareas_paciente_idx on public.tareas_terapeuticas(paciente_id);
create index if not exists tareas_user_estado_idx on public.tareas_terapeuticas(user_id, estado);

alter table public.tareas_terapeuticas enable row level security;

create policy "select_own_tareas"
  on public.tareas_terapeuticas for select
  using (auth.uid() = user_id);

create policy "insert_own_tareas"
  on public.tareas_terapeuticas for insert
  with check (auth.uid() = user_id);

create policy "update_own_tareas"
  on public.tareas_terapeuticas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own_tareas"
  on public.tareas_terapeuticas for delete
  using (auth.uid() = user_id);
