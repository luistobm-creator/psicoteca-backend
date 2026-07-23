-- ============================================================
-- Facturacion y pagos -- tabla + RLS
-- Ejecutar en el editor SQL de Supabase (proyecto de Psicoteca).
-- Cada usuario solo puede ver, crear y actualizar sus propios cobros.
-- ============================================================

create table if not exists public.facturacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  monto numeric(10,2) not null,
  fecha date not null,
  concepto text,
  estado text not null default 'pendiente',   -- 'pendiente' | 'pagado' | 'anulado'
  created_at timestamptz not null default now()
);

create index if not exists facturacion_paciente_idx on public.facturacion(paciente_id);
create index if not exists facturacion_user_estado_idx on public.facturacion(user_id, estado);

alter table public.facturacion enable row level security;

create policy "select_own_facturacion"
  on public.facturacion for select
  using (auth.uid() = user_id);

create policy "insert_own_facturacion"
  on public.facturacion for insert
  with check (auth.uid() = user_id);

create policy "update_own_facturacion"
  on public.facturacion for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin politica de "delete" a proposito: un cobro no se borra, se anula
-- (estado='anulado') -- mismo criterio de preservar historial que ya
-- usamos en pacientes/citas. Es un registro financiero, con mas razon.
