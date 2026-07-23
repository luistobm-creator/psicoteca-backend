-- ============================================================
-- Consentimiento con firma -- tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
--
-- Registro legal/clinico: una vez firmado, NO se edita ni se borra (por
-- eso no hay policy de update/delete) -- es un historial permanente de lo
-- que el paciente acepto y cuando, igual de estricto que facturacion.
-- ============================================================

create table if not exists public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  texto text not null,
  nombre_firma text not null,
  firmado_en timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists consentimientos_paciente_idx
  on public.consentimientos(paciente_id, created_at desc);

alter table public.consentimientos enable row level security;

create policy "select_own_consentimientos"
  on public.consentimientos for select
  using (auth.uid() = user_id);

create policy "insert_own_consentimientos"
  on public.consentimientos for insert
  with check (auth.uid() = user_id);

-- Sin policies de update/delete a proposito: ver nota arriba.
