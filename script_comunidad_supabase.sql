-- ============================================================
-- Ecosistema de Comunidad: Perfiles publicos, Ranking, Grupos de
-- estudio y Mensajes directos. Ejecutar en el editor SQL de Supabase.
--
-- DISEÑO DE SEGURIDAD (leer antes de ejecutar):
-- Estas son las UNICAS tablas de todo Psicoteca con RLS cruzada entre
-- usuarios. Ninguna tabla clinica/de negocio existente (pacientes,
-- glosario_clinico, examenes, facturacion, notas_voz, consentimientos,
-- agenda_citas, tareas_terapeuticas) se toca ni se altera aqui -- siguen
-- 100% aisladas por usuario, exactamente igual que antes.
--
-- La Comunidad es OPT-IN: nadie aparece en el directorio, el ranking ni es
-- localizable para mensajes/grupos hasta que activa su perfil
-- (perfiles_comunidad.activo = true).
--
-- El "puntaje" del ranking (perfiles_comunidad.puntos) NUNCA lo escribe el
-- cliente directamente -- solo lo calcula el backend, leyendo el propio
-- glosario/examenes del usuario con su propio token (la RLS de esas tablas
-- ya garantiza que solo puede leer sus propias filas), y publica un unico
-- numero agregado. Ver `backend/app/routers/comunidad_perfiles.py`.
-- ============================================================

-- --------------------------------------------------------------
-- 1) Perfiles de comunidad (opt-in) + Ranking
-- --------------------------------------------------------------
create table if not exists public.perfiles_comunidad (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_publico text,
  especialidad text,
  bio text,
  activo boolean not null default false,
  puntos integer not null default 0,
  puntos_actualizado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfiles_comunidad enable row level security;

-- Cualquiera autenticado ve los perfiles ACTIVOS (directorio/ranking); el
-- propio dueño ve siempre el suyo, incluso antes de activarlo (para poder
-- editarlo primero).
create policy "select_perfiles_comunidad"
  on public.perfiles_comunidad for select
  using (activo = true or auth.uid() = user_id);

create policy "insert_own_perfil_comunidad"
  on public.perfiles_comunidad for insert
  with check (auth.uid() = user_id);

create policy "update_own_perfil_comunidad"
  on public.perfiles_comunidad for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --------------------------------------------------------------
-- 2) Grupos de estudio + membresia
-- --------------------------------------------------------------
create table if not exists public.grupos_estudio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  creado_por uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.grupos_estudio enable row level security;

-- El listado de grupos (nombre/descripcion) es visible para cualquier
-- usuario autenticado -- hace falta poder "descubrir" un grupo antes de
-- unirte. No es informacion sensible.
create policy "select_grupos"
  on public.grupos_estudio for select
  using (auth.uid() is not null);

create policy "insert_grupos"
  on public.grupos_estudio for insert
  with check (auth.uid() = creado_por);

create policy "update_own_grupos"
  on public.grupos_estudio for update
  using (auth.uid() = creado_por)
  with check (auth.uid() = creado_por);

create policy "delete_own_grupos"
  on public.grupos_estudio for delete
  using (auth.uid() = creado_por);

create table if not exists public.grupos_miembros (
  grupo_id uuid not null references public.grupos_estudio(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'miembro',
  joined_at timestamptz not null default now(),
  primary key (grupo_id, user_id)
);

alter table public.grupos_miembros enable row level security;

-- Función SECURITY DEFINER para comprobar membresía: IMPRESCINDIBLE. Una
-- policy de "select" en grupos_miembros que consulta grupos_miembros
-- directamente (aunque sea con un alias distinto) dispara la MISMA policy
-- recursivamente sobre esa subconsulta -> "infinite recursion detected in
-- policy". SECURITY DEFINER hace que la función corra con los privilegios
-- de quien la creó (no los del usuario que llama), así que su consulta
-- interna NO vuelve a pasar por RLS y la recursión nunca ocurre.
create or replace function public.is_miembro_de_grupo(p_grupo_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.grupos_miembros
    where grupo_id = p_grupo_id and user_id = p_user_id
  );
$$;

-- Ves las filas de membresia de los grupos donde TU ya eres miembro (para
-- poder listar a tus compañeros de grupo).
create policy "select_miembros_de_mis_grupos"
  on public.grupos_miembros for select
  using (public.is_miembro_de_grupo(grupos_miembros.grupo_id, auth.uid()));

create policy "insert_own_membership"
  on public.grupos_miembros for insert
  with check (auth.uid() = user_id);

create policy "delete_own_membership"
  on public.grupos_miembros for delete
  using (auth.uid() = user_id);

create table if not exists public.grupos_mensajes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_estudio(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists grupos_mensajes_grupo_idx
  on public.grupos_mensajes(grupo_id, created_at desc);

alter table public.grupos_mensajes enable row level security;

-- Solo lees mensajes de grupos donde ERES MIEMBRO ACTUAL (si sales del
-- grupo, pierdes acceso a su historial -- igual que la mayoria de apps de
-- chat/canales). Usa la misma función SECURITY DEFINER de arriba -- evita
-- depender de que la policy de grupos_miembros esté "bien" para no
-- arrastrar la misma recursión hacia esta tabla.
create policy "select_mensajes_de_mis_grupos"
  on public.grupos_mensajes for select
  using (public.is_miembro_de_grupo(grupos_mensajes.grupo_id, auth.uid()));

create policy "insert_mensajes_si_soy_miembro"
  on public.grupos_mensajes for insert
  with check (
    auth.uid() = user_id
    and public.is_miembro_de_grupo(grupos_mensajes.grupo_id, auth.uid())
  );

create policy "delete_own_mensaje_grupo"
  on public.grupos_mensajes for delete
  using (auth.uid() = user_id);

-- --------------------------------------------------------------
-- 3) Mensajes directos (1 a 1)
-- --------------------------------------------------------------
create table if not exists public.mensajes_directos (
  id uuid primary key default gen_random_uuid(),
  remitente_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null,
  leido boolean not null default false,
  created_at timestamptz not null default now(),
  constraint no_auto_mensaje check (remitente_id <> destinatario_id)
);

create index if not exists mensajes_directos_remitente_idx
  on public.mensajes_directos(remitente_id, created_at desc);
create index if not exists mensajes_directos_destinatario_idx
  on public.mensajes_directos(destinatario_id, created_at desc);

alter table public.mensajes_directos enable row level security;

-- Lees un mensaje si eres remitente O destinatario -- nunca un tercero.
create policy "select_mis_mensajes_directos"
  on public.mensajes_directos for select
  using (auth.uid() = remitente_id or auth.uid() = destinatario_id);

create policy "insert_como_remitente"
  on public.mensajes_directos for insert
  with check (auth.uid() = remitente_id);

-- Solo el DESTINATARIO puede actualizar (marcar leido). El backend limita
-- el PATCH a ese unico campo a nivel de aplicacion (Pydantic), no aqui.
create policy "update_marcar_leido"
  on public.mensajes_directos for update
  using (auth.uid() = destinatario_id)
  with check (auth.uid() = destinatario_id);
