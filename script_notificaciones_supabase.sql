-- ============================================================
-- Notificaciones (preferencias) -- tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Una fila por usuario (user_id es la propia llave primaria).
--
-- OJO: esta tabla guarda la PREFERENCIA del usuario. Todavia no existe
-- infraestructura de envio (correo/push) en el backend -- este esquema deja
-- lista la fuente de verdad para cuando se conecte esa parte.
-- ============================================================

create table if not exists public.notificaciones_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recordatorio_citas boolean not null default true,
  tareas_pendientes boolean not null default true,
  resumen_semanal boolean not null default true,
  novedades_producto boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notificaciones_config enable row level security;

create policy "select_own_notif_config"
  on public.notificaciones_config for select
  using (auth.uid() = user_id);

create policy "insert_own_notif_config"
  on public.notificaciones_config for insert
  with check (auth.uid() = user_id);

create policy "update_own_notif_config"
  on public.notificaciones_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
