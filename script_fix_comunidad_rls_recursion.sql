-- ============================================================
-- FIX: "infinite recursion detected in policy for relation
-- 'grupos_miembros'" al usar Grupos de estudio.
--
-- Causa: la policy de select de grupos_miembros consultaba la propia tabla
-- grupos_miembros para comprobar la membresía -- eso dispara la MISMA
-- policy otra vez sobre esa subconsulta, en bucle. Las policies de
-- grupos_mensajes tenían el mismo patrón (consultaban grupos_miembros
-- directamente), así que heredaban el mismo riesgo.
--
-- Solución: una función SECURITY DEFINER, que corre con privilegios de
-- quien la creó (no del usuario que llama) -- su consulta interna no
-- vuelve a pasar por RLS, así que no hay recursión posible.
--
-- Ejecutar en el editor SQL de Supabase. Es seguro correrlo aunque ya
-- hayas ejecutado script_comunidad_supabase.sql -- solo reemplaza las 3
-- policies afectadas, no toca datos ni el resto del esquema.
-- ============================================================

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

drop policy if exists "select_miembros_de_mis_grupos" on public.grupos_miembros;
create policy "select_miembros_de_mis_grupos"
  on public.grupos_miembros for select
  using (public.is_miembro_de_grupo(grupos_miembros.grupo_id, auth.uid()));

drop policy if exists "select_mensajes_de_mis_grupos" on public.grupos_mensajes;
create policy "select_mensajes_de_mis_grupos"
  on public.grupos_mensajes for select
  using (public.is_miembro_de_grupo(grupos_mensajes.grupo_id, auth.uid()));

drop policy if exists "insert_mensajes_si_soy_miembro" on public.grupos_mensajes;
create policy "insert_mensajes_si_soy_miembro"
  on public.grupos_mensajes for insert
  with check (
    auth.uid() = user_id
    and public.is_miembro_de_grupo(grupos_mensajes.grupo_id, auth.uid())
  );
