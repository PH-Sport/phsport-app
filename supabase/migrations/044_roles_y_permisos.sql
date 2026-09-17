-- 044: nace el modelo de roles y permisos, al lado del rol antiguo.
--
-- Hasta hoy `profiles.role` (ADMIN | DESIGNER) hacía dos cosas a la vez: decir
-- quién entra en el reparto y hacer de permiso para invitar y gestionar. Con
-- gente de fuera en la app (futbolistas) eso se queda corto: un futbolista no
-- es ni lo uno ni lo otro, y dentro del equipo hay grano —Izan y Lluís invitan,
-- Loren y Pau no— sin que haya jerarquía. Diseño completo en
-- docs/superpowers/specs/2026-09-14-roles-departamentos-y-jugadores-design.md §4.
--
-- Esta migración SOLO AÑADE. No toca ninguna política ni la columna `role`:
-- producción y preview comparten esta base, y `main` sigue leyendo `role` hasta
-- que lleve el código nuevo. El cierre de políticas es la 045; borrar lo viejo,
-- la 046 (solo tras el merge a main).
--
-- Los permisos (qué significa cada clave) viven en el código, en
-- lib/utils/access.ts. Aquí no se validan a propósito: añadir uno debe ser una
-- línea de código y una fila, no una migración.

-- ─── 1. Tipo de cuenta: la barrera dura ───────────────────────────────────

create type public.account_kind as enum ('AGENCIA', 'JUGADOR');

alter table public.profiles
  add column kind public.account_kind not null default 'AGENCIA';

-- ─── 2. Roles, permisos por rol, roles por persona ───────────────────────

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_name_unique unique (name),
  constraint roles_name_not_blank check (btrim(name) <> '')
);

create trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role_id uuid not null,
  permission text not null,
  constraint role_permissions_pkey primary key (role_id, permission),
  constraint role_permissions_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete cascade
);

-- Un rol no se puede borrar mientras alguien lo tenga (restrict): primero se
-- reasigna a la persona, luego se borra el rol. Evita que alguien pierda acceso
-- sin que nadie lo haya decidido sobre él.
create table public.profile_roles (
  profile_id uuid not null,
  role_id uuid not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  constraint profile_roles_pkey primary key (profile_id, role_id),
  constraint profile_roles_profile_id_fkey
    foreign key (profile_id) references public.profiles(id) on delete cascade,
  constraint profile_roles_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete restrict,
  constraint profile_roles_granted_by_fkey
    foreign key (granted_by) references public.profiles(id) on delete set null
);

create index profile_roles_role_id_idx on public.profile_roles (role_id);

-- ─── 3. Las tres preguntas que hacen las políticas ────────────────────────
--
-- SECURITY DEFINER a propósito: las políticas de `profile_roles` llaman a
-- estas funciones, y si ellas leyeran `profile_roles` bajo RLS se llamarían a
-- sí mismas (recursión infinita, la misma que arregló la migración
-- fix_profiles_infinite_recursion en su día). Las ejecuta `authenticated`
-- (las políticas se evalúan como el rol que consulta) y `service_role` (la
-- función de borrar usuarios). A `anon` se le quita: ninguna política le deja
-- pasar (auth.uid() es null) y no tiene por qué poder preguntar por RPC
-- «¿tiene este uuid este permiso?» sin sesión.

create function public.has_permission(uid uuid, perm text)
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
  );
$$;

create function public.in_department(uid uuid, dept text)
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
  );
$$;

-- «Es de la agencia y tiene al menos un rol». Una cuenta sin roles no ve nada:
-- así una cuenta creada fuera del flujo de invitación no accede a nada.
create function public.is_staff(uid uuid)
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
  );
$$;

revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.in_department(uuid, text) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
grant execute on function public.has_permission(uuid, text) to authenticated, service_role;
grant execute on function public.in_department(uuid, text) to authenticated, service_role;
grant execute on function public.is_staff(uuid) to authenticated, service_role;

-- ─── 4. Quién entra en el reparto ─────────────────────────────────────────
--
-- SECURITY INVOKER (el valor por defecto): respeta la RLS de `profiles`, así
-- que devuelve exactamente lo que el llamante puede ver. Sustituye a los seis
-- `.eq('role', 'DESIGNER')` del código.

create function public.profiles_with_permission(perm text)
returns setof public.profiles
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where p.kind = 'AGENCIA'
    and exists (
      select 1
      from public.profile_roles pr
      join public.role_permissions rp on rp.role_id = pr.role_id
      where pr.profile_id = p.id
        and rp.permission = perm
    );
$$;

-- ─── 5. Asignar roles a una persona, de una vez ───────────────────────────
--
-- «Que le queden exactamente estos roles». Si el cliente hiciera borrar +
-- insertar en dos peticiones, la guardia del §7 saltaría en medio (durante un
-- instante nadie tendría gestionar_roles). Una función lo hace en una
-- transacción. SECURITY INVOKER: la RLS de profile_roles sigue mandando (hace
-- falta gestionar_roles). Los roles en sí no se editan desde la app: son
-- fijos, y cambiarlos es una migración.

create function public.set_profile_roles(p_profile_id uuid, p_role_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = p_profile_id and kind = 'JUGADOR') then
    raise exception 'Un futbolista no tiene roles' using errcode = 'check_violation';
  end if;

  delete from public.profile_roles
  where profile_id = p_profile_id
    and role_id <> all (p_role_ids);

  insert into public.profile_roles (profile_id, role_id, granted_by)
  select p_profile_id, x, auth.uid()
  from unnest(p_role_ids) as x
  on conflict do nothing;
end;
$$;

-- ─── 6. Auditoría: quién dio qué rol a quién ──────────────────────────────

create function public.log_rbac_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, entity, entity_id, action, payload)
    values (auth.uid(), 'profile_roles', new.profile_id, 'GRANT',
            jsonb_build_object('role_id', new.role_id, 'granted_by', new.granted_by));
    return new;
  else
    insert into public.audit_log (actor_id, entity, entity_id, action, payload)
    values (auth.uid(), 'profile_roles', old.profile_id, 'REVOKE',
            jsonb_build_object('role_id', old.role_id));
    return old;
  end if;
end;
$$;

revoke execute on function public.log_rbac_audit() from public, anon, authenticated;

create trigger trg_profile_roles_audit
  after insert or delete on public.profile_roles
  for each row execute function public.log_rbac_audit();

-- ─── 7. Guardia: nunca se queda la agencia sin nadie que gestione roles ───
--
-- Sustituye al «debe quedar al menos un Mánager» que hoy vive en la ruta
-- /api/users/[id]. Aquí es infranqueable también por PostgREST directo.
-- DEFERRABLE INITIALLY DEFERRED: se comprueba al final de la transacción, así
-- que «quitar a uno y dárselo a otro» en la misma transacción pasa.
--
-- También frena BORRAR a la última persona con gestionar_roles (la función
-- admin-delete-user borra el auth.user, que cascada a profiles y a
-- profile_roles): la transacción se aborta y la cuenta se queda. Es lo que
-- se quiere; la función traduce ese error a un 409 con explicación.

create function public.assert_role_manager_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profile_roles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where rp.permission = 'gestionar_roles'
      and p.kind = 'AGENCIA'
  ) then
    raise exception 'Debe quedar al menos una persona con el permiso gestionar_roles'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

revoke execute on function public.assert_role_manager_remains() from public, anon, authenticated;

create constraint trigger trg_profile_roles_keep_manager
  after delete or update on public.profile_roles
  deferrable initially deferred
  for each row execute function public.assert_role_manager_remains();

create constraint trigger trg_profiles_kind_keep_manager
  after update of kind on public.profiles
  deferrable initially deferred
  for each row execute function public.assert_role_manager_remains();

-- ─── 8. RLS de las tablas nuevas ──────────────────────────────────────────
--
-- `roles` y `role_permissions` solo se LEEN desde la app (el personal, para
-- el selector y los distintivos). Sin política de escritura no las escribe
-- nadie que no sea una migración. `profile_roles` la escribe quien gestiona
-- roles, a través de set_profile_roles.

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profile_roles enable row level security;

create policy roles_select_staff on public.roles
  for select using (public.is_staff(auth.uid()));

create policy role_permissions_select_staff on public.role_permissions
  for select using (public.is_staff(auth.uid()));

create policy profile_roles_select_staff on public.profile_roles
  for select using (public.is_staff(auth.uid()));
create policy profile_roles_manage on public.profile_roles
  for all
  using (public.has_permission(auth.uid(), 'gestionar_roles'))
  with check (public.has_permission(auth.uid(), 'gestionar_roles'));

-- ─── 9. Los tres roles, fijos ─────────────────────────────────────────────
--
-- Cambiar un rol o sus permisos es escribir otra migración como esta (una
-- fila por permiso). Decisión de Mario del 2026-09-16: sin pantalla de roles.

insert into public.roles (name, department) values
  ('Gestor creativo', 'creativo'),
  ('Diseñador senior', 'creativo'),
  ('Diseñador', 'creativo');

insert into public.role_permissions (role_id, permission)
select r.id, x.permission
from public.roles r
join (values
  ('Gestor creativo',  'invitar_personal'),
  ('Gestor creativo',  'invitar_jugadores'),
  ('Gestor creativo',  'gestionar_roles'),
  ('Diseñador senior', 'invitar_personal'),
  ('Diseñador senior', 'invitar_jugadores'),
  ('Diseñador senior', 'recibir_asignaciones'),
  ('Diseñador',        'invitar_jugadores'),
  ('Diseñador',        'recibir_asignaciones')
) as x(role_name, permission) on x.role_name = r.name;

-- ─── 10. Las ocho personas ────────────────────────────────────────────────
--
-- Determinista desde el rol antiguo: ADMIN → Gestor creativo, DESIGNER →
-- Diseñador. Izan y Lluís pasan a «Diseñador senior» desde Ajustes → Miembros,
-- a mano: una migración no lleva nombres de personas.

insert into public.profile_roles (profile_id, role_id)
select p.id, r.id
from public.profiles p
join public.roles r
  on r.name = case p.role when 'ADMIN' then 'Gestor creativo' else 'Diseñador' end;

-- ─── 11. Invitaciones: apuntan a un rol y recuerdan quién las creó ────────
--
-- `role_id` se queda NULLABLE hasta la 046: el diálogo que hoy corre en main
-- inserta solo `role` (texto), y no puede romperse. `use_invitation` acepta
-- las dos formas mientras tanto.
--
-- `on delete cascade`: una invitación a un rol que ya no existe no vale para
-- nada, y con `restrict` un rol con una invitación caducada colgando no se
-- podría borrar nunca.

alter table public.invitations
  add column role_id uuid,
  add column created_by uuid default auth.uid(),
  add constraint invitations_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete cascade,
  add constraint invitations_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

update public.invitations i
set role_id = r.id
from public.roles r
where r.name = case i.role when 'ADMIN' then 'Gestor creativo' else 'Diseñador' end;

-- ─── 12. Aceptar una invitación da un rol, no una casilla ─────────────────
--
-- Puente entre los dos mundos: da el rol nuevo (profile_roles) y, mientras
-- exista `profiles.role`, lo deja coherente derivándolo de los permisos del
-- rol (quien gestiona roles era «ADMIN»). La 046 quita la parte antigua.

create or replace function public.use_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation record;
  v_current_uses int;
  v_role_id uuid;
begin
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitación no encontrada';
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    raise exception 'Esta invitación ha expirado';
  end if;

  select count(*) into v_current_uses
  from public.invitation_uses
  where invitation_id = p_invitation_id;

  if v_current_uses >= v_invitation.max_uses then
    raise exception 'Esta invitación ya ha alcanzado el límite de usos';
  end if;

  insert into public.invitation_uses (invitation_id, user_id, email, full_name)
  values (p_invitation_id, p_user_id, p_email, p_full_name);

  -- Rol nuevo: el de la invitación, o el equivalente del texto antiguo.
  v_role_id := v_invitation.role_id;
  if v_role_id is null then
    select r.id into v_role_id
    from public.roles r
    where r.name = case v_invitation.role when 'ADMIN' then 'Gestor creativo' else 'Diseñador' end;
  end if;

  insert into public.profile_roles (profile_id, role_id, granted_by)
  values (p_user_id, v_role_id, v_invitation.created_by)
  on conflict do nothing;

  -- Casilla antigua, coherente hasta la 046.
  update public.profiles
  set role = case
        when exists (
          select 1 from public.role_permissions rp
          where rp.role_id = v_role_id and rp.permission = 'gestionar_roles'
        ) then 'ADMIN'::public.role_enum
        else 'DESIGNER'::public.role_enum
      end,
      kind = 'AGENCIA'
  where id = p_user_id;

  return true;
end;
$function$;

-- La página de invitación enseña el nombre del rol. Se conserva `role` en la
-- salida para el código que corre en main; la 046 lo quita.
drop function public.get_invitation_by_token(text);

create function public.get_invitation_by_token(p_token text)
returns table (id uuid, role text, role_name text, valid boolean)
language sql
security definer
set search_path = ''
as $$
  select i.id,
         i.role::text,
         r.name,
         ((i.expires_at is null or i.expires_at > now())
           and (select count(*) from public.invitation_uses u where u.invitation_id = i.id) < i.max_uses) as valid
  from public.invitations i
  left join public.roles r on r.id = i.role_id
  where i.token = p_token;
$$;

-- La llama `anon` desde la página de invitación (como dejó explícito la 033).
revoke execute on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated, service_role;
