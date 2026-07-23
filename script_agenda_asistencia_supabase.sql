-- ============================================================
-- Agenda de citas -- columna aditiva "asistio" (para Estadisticas del
-- consultorio: indice de asistencia). Ejecutar en el editor SQL de Supabase.
--
-- Aditivo y no destructivo: agrega una columna NULLABLE nueva a una tabla
-- que ya existe y esta en uso. No toca ninguna fila ni columna existente --
-- las citas que ya tienes siguen funcionando exactamente igual. NULL
-- significa "todavia no marcada" (ni asistio ni no-asistio).
-- ============================================================

alter table public.agenda_citas
  add column if not exists asistio boolean;
