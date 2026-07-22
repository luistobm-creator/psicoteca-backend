-- ============================================================
-- Modo examen — tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Las preguntas se generan al vuelo en el cliente a partir del Glosario
-- clínico; aquí solo se guarda el resultado (snapshot de preguntas +
-- respuestas + calificación) de cada examen ya terminado.
-- ============================================================

create table if not exists public.examenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text,                          -- null = "todas las categorías"
  num_preguntas integer not null,
  respuestas_correctas integer not null,
  tiempo_limite_segundos integer,          -- null = sin cronómetro
  tiempo_usado_segundos integer,
  preguntas jsonb not null,                -- [{termino, opciones:[...], correcta, elegida}, ...]
  created_at timestamptz not null default now()
);

create index if not exists examenes_user_idx on public.examenes(user_id, created_at desc);

alter table public.examenes enable row level security;

create policy "select_own_examenes"
  on public.examenes for select
  using (auth.uid() = user_id);

create policy "insert_own_examenes"
  on public.examenes for insert
  with check (auth.uid() = user_id);

-- Sin política de "update": un resultado ya calificado no se edita.
create policy "delete_own_examenes"
  on public.examenes for delete
  using (auth.uid() = user_id);
