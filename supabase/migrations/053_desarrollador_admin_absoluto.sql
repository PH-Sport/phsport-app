-- 053 · La cuenta de desarrollador es admin absoluto
--
-- Pendiente 6 de docs/estado-y-traspaso.md, alcance decidido por Mario el
-- 2026-11-02: la cuenta con `profiles.is_dev` ve y gestiona todos los
-- departamentos con todos sus permisos sin tener rol en ellos. Mario no tendrá
-- rol de Agentes (pendiente 13.4) y así entra al campograma con su cuenta. Las
-- herramientas de prueba de la cabina no van aquí: esperan a Supabase Pro.
--
-- Por qué la marca aguanta como llave: desde el cliente nadie escribe
-- `is_dev` (la 045 quitó el UPDATE de esa columna y `profiles` no tiene
-- políticas de INSERT ni DELETE) y ninguna función la toca. Solo se pone desde
-- el panel de Supabase. Comprobado en la base el 2026-11-02.
--
-- Qué se toca: las tres funciones con las que deciden las políticas. Todas las
-- políticas y funciones que las usan preguntan por quien llama
-- (`auth.uid()`); ninguna recorre personas, así que la cuenta no aparece en
-- ninguna lista ajena (comprobado el mismo día en pg_policies y pg_proc).
--
-- Dos límites a propósito, que la app repite en `deriveAccess`
-- (lib/utils/access.ts):
--   - `recibir_asignaciones` no entra: no es un poder sino «ser diseñador».
--     Es además el único sitio donde se pregunta por otra persona: al
--     reasignar un diseño, la API comprueba con `has_permission` que el
--     destino reciba asignaciones. Con él dentro, la cuenta valdría de destino.
--   - Solo cuentan permisos que tenga hoy algún rol. Sin esto,
--     `invitar_jugadores` (retirado en la 052, pero `can_manage_invitation` aún
--     lo consulta) se volvería a abrir para esta cuenta.
-- La marca suma y nunca quita, y una cuenta JUGADOR no obtiene nada aunque la
-- tenga, igual que con los roles.
--
-- `main` no lee permisos, y la única cuenta con la marca ya tiene en creativo
-- todo lo que producción usa: producción no lo nota.
--
-- Para revertirlo, volver a crear las tres funciones sin el segundo `exists`:
-- la primera mitad de cada una es su definición anterior, sin cambios.

create or replace function public.has_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = uid
      and rp.permission = perm
      and p.kind = 'AGENCIA'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.kind = 'AGENCIA'
      and p.is_dev
      and perm <> 'recibir_asignaciones'
      and exists (select 1 from public.role_permissions rp where rp.permission = perm)
  );
$$;

create or replace function public.in_department(uid uuid, dept text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = uid
      and r.department = dept
      and p.kind = 'AGENCIA'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.kind = 'AGENCIA'
      and p.is_dev
      and exists (select 1 from public.roles r where r.department = dept)
  );
$$;

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = uid
      and p.kind = 'AGENCIA'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.kind = 'AGENCIA'
      and p.is_dev
  );
$$;
