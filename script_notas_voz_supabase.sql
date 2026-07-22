-- ============================================================
-- Notas de voz — tabla + bucket privado de Storage + políticas
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- ============================================================

create table if not exists public.notas_voz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  cita_id uuid references public.agenda_citas(id) on delete set null,
  storage_path text not null,
  duracion_segundos integer,
  titulo text,
  transcripcion text,     -- NULL por ahora; lo llenará la futura herramienta de transcripción
  created_at timestamptz not null default now()
);

create index if not exists notas_voz_paciente_idx on public.notas_voz(paciente_id);

alter table public.notas_voz enable row level security;

create policy "select_own_notas"
  on public.notas_voz for select
  using (auth.uid() = user_id);

create policy "insert_own_notas"
  on public.notas_voz for insert
  with check (auth.uid() = user_id);

-- A diferencia de citas/pacientes, aquí SÍ hay borrado real: una grabación
-- fallida o del paciente equivocado se debe poder eliminar de verdad.
create policy "delete_own_notas"
  on public.notas_voz for delete
  using (auth.uid() = user_id);

-- --- Bucket de audio (privado) -------------------------------------------
insert into storage.buckets (id, name, public)
  values ('notas-voz', 'notas-voz', false)
  on conflict (id) do nothing;

-- Cada archivo vive en "notas-voz/{user_id}/{nota_id}.ext": la política exige
-- que la primera carpeta de la ruta coincida con el usuario autenticado, así
-- que nadie puede leer ni escribir en la carpeta de otro terapeuta.
create policy "select_own_audio"
  on storage.objects for select
  using (bucket_id = 'notas-voz' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "insert_own_audio"
  on storage.objects for insert
  with check (bucket_id = 'notas-voz' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete_own_audio"
  on storage.objects for delete
  using (bucket_id = 'notas-voz' and (storage.foldername(name))[1] = auth.uid()::text);
