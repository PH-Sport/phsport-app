-- 050: nace el departamento de Agentes.
--
-- Fase 1 del campograma dentro de la app. Spec:
-- docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md (§2, §3).
-- Plan: docs/superpowers/plans/2026-10-11-campograma-fase-1-agentes.md.
--
-- SOLO AÑADE, y lo que sustituye (políticas de `invitations` y
-- `use_invitation`) se comporta igual para todo lo que ya existe. Producción
-- (`main`) comparte esta base y no sabe nada de Agentes:
--   · `main` crea invitaciones sin `role_id`: se tratan como de creativo, igual que hoy.
--   · `main` toma por diseñador a todo `profiles.role = 'DESIGNER'` y le
--     reparte trabajo. Un agente no puede nacer DESIGNER: nace AGENTE en la
--     casilla antigua. Se va con la 049, que borra la casilla.

-- ─── 0. La casilla antigua tiene que poder decir «agente» ─────────────────
--
-- Igual que JUGADOR en la 046: el valor nuevo no se puede usar en la misma
-- transacción que lo crea, así que solo aparece dentro de cuerpos de función.

alter type public.role_enum add value if not exists 'AGENTE';

-- ─── 1. De qué departamento es un rol ─────────────────────────────────────
--
-- SECURITY DEFINER por lo mismo que has_permission (044 §3): la usan las
-- políticas de `profile_roles`, y leer `roles` bajo RLS desde ahí no debe
-- depender de quién consulta.

create function public.role_department(p_role_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.department from public.roles r where r.id = p_role_id;
$$;
revoke execute on function public.role_department(uuid) from public, anon;
grant execute on function public.role_department(uuid) to authenticated, service_role;

-- ─── 2. Los dos roles, fijos ──────────────────────────────────────────────
--
-- Sin jerarquía salvo esta: el director invita y reparte dentro de Agentes.
-- El agente no trae permisos: su acceso es el departamento (la cartera de la
-- fase 2 pregunta por in_department(…, 'agentes')). Cambiar un rol es otra
-- migración, como en la 044.

insert into public.roles (name, department) values
  ('Agente', 'agentes'),
  ('Director', 'agentes');

insert into public.role_permissions (role_id, permission)
select r.id, x.permission
from public.roles r
join (values
  ('Director', 'invitar_agentes'),
  ('Director', 'gestionar_agentes')
) as x(role_name, permission) on x.role_name = r.name;

-- ─── 3. Repartir roles de Agentes sin tocar los de creativo ───────────────
--
-- Se suma a `profile_roles_manage` (gestionar_roles, todo): las políticas
-- permisivas se combinan con OR.

create policy profile_roles_manage_agentes on public.profile_roles
  for all
  using (
    public.has_permission(auth.uid(), 'gestionar_agentes')
    and public.role_department(role_id) = 'agentes'
  )
  with check (
    public.has_permission(auth.uid(), 'gestionar_agentes')
    and public.role_department(role_id) = 'agentes'
  );

-- «Que en este departamento le quede este rol», sin tocar los demás
-- departamentos. set_profile_roles (044 §5) reemplaza TODOS los roles de la
-- persona: con dos departamentos, cambiar uno borraba el otro. SECURITY
-- INVOKER: la RLS de profile_roles decide quién puede (gestionar_roles para
-- todo, gestionar_agentes para Agentes). Quitarle a alguien su único rol no
-- se ofrece en esta fase: siempre se pone uno.

create function public.set_department_role(p_profile_id uuid, p_department text, p_role_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = p_profile_id and kind = 'JUGADOR') then
    raise exception 'Un futbolista no tiene roles' using errcode = 'check_violation';
  end if;

  if public.role_department(p_role_id) is distinct from p_department then
    raise exception 'Ese rol no es de ese departamento' using errcode = 'check_violation';
  end if;

  delete from public.profile_roles pr
  using public.roles r
  where r.id = pr.role_id
    and pr.profile_id = p_profile_id
    and r.department = p_department
    and pr.role_id <> p_role_id;

  insert into public.profile_roles (profile_id, role_id, granted_by)
  values (p_profile_id, p_role_id, auth.uid())
  on conflict do nothing;
end;
$$;
revoke execute on function public.set_department_role(uuid, text, uuid) from public, anon;
grant execute on function public.set_department_role(uuid, text, uuid) to authenticated;

-- ─── 4. Invitaciones: cada uno a su departamento ──────────────────────────
--
-- Antes: invitar_personal invitaba a cualquier rol. Ahora el rol de la
-- invitación decide qué permiso hace falta. Sin `role_id` (las que crea
-- `main`) cuenta como creativo, que es lo que eran.

create function public.can_manage_invitation(uid uuid, p_role_id uuid, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_player_id is not null then
      public.has_permission(uid, 'invitar_jugadores')
    when coalesce(public.role_department(p_role_id), 'creativo') = 'creativo' then
      public.has_permission(uid, 'invitar_personal') or public.has_permission(uid, 'gestionar_roles')
    when public.role_department(p_role_id) = 'agentes' then
      public.has_permission(uid, 'invitar_agentes') or public.has_permission(uid, 'gestionar_roles')
    else false
  end;
$$;
revoke execute on function public.can_manage_invitation(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_manage_invitation(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists invitations_select_inviters on public.invitations;
drop policy if exists invitations_insert_inviters on public.invitations;
drop policy if exists invitations_update_inviters on public.invitations;
drop policy if exists invitations_delete_inviters on public.invitations;

create policy invitations_select_inviters on public.invitations
  for select using (public.can_manage_invitation(auth.uid(), role_id, player_id));
create policy invitations_insert_inviters on public.invitations
  for insert with check (
    created_by = auth.uid()
    and public.can_manage_invitation(auth.uid(), role_id, player_id)
  );
create policy invitations_update_inviters on public.invitations
  for update
  using (public.can_manage_invitation(auth.uid(), role_id, player_id))
  with check (public.can_manage_invitation(auth.uid(), role_id, player_id));
create policy invitations_delete_inviters on public.invitations
  for delete using (public.can_manage_invitation(auth.uid(), role_id, player_id));

-- ─── 5. use_invitation v4: un agente nace AGENTE en la casilla antigua ─────
--
-- Idéntica a la de la 046 salvo el `update public.profiles` final de la rama
-- del personal.

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
as $$
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

  -- La cuenta que se engancha tiene que ser la de quien llama. Si el alta no
  -- devuelve sesión (confirmación de correo activada), quien llama es anon:
  -- entonces solo vale un perfil recién nacido, sin roles y sin ficha. Sin
  -- esto, un enlace válido servía para degradar a JUGADOR a cualquier cuenta
  -- de la agencia cuyo uuid se conociera (revisión del 2026-09-17).
  if auth.uid() is not null then
    if auth.uid() <> p_user_id then
      raise exception 'La invitación solo puede usarla la cuenta que acaba de crearse';
    end if;
  elsif not exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.created_at > now() - interval '15 minutes'
      and not exists (select 1 from public.profile_roles pr where pr.profile_id = p.id)
      and not exists (select 1 from public.players pl where pl.profile_id = p.id)
  ) then
    raise exception 'La invitación solo puede usarla una cuenta recién creada';
  end if;

  insert into public.invitation_uses (invitation_id, user_id, email, full_name)
  values (p_invitation_id, p_user_id, p_email, p_full_name);

  -- Rama del jugador (spec §8): la cuenta queda marcada como JUGADOR y
  -- enganchada a esa ficha sola; sin roles. La casilla antigua `role` dice
  -- también JUGADOR, para que `main` no lo tome por diseñador.
  if v_invitation.player_id is not null then
    update public.players
    set profile_id = p_user_id
    where id = v_invitation.player_id
      and profile_id is null;

    if not found then
      raise exception 'Esta ficha ya tiene cuenta';
    end if;

    update public.profiles
    set kind = 'JUGADOR',
        role = 'JUGADOR'::public.role_enum
    where id = p_user_id;

    return true;
  end if;

  -- Rama del personal: igual que la v2 de la 044.
  v_role_id := v_invitation.role_id;
  if v_role_id is null then
    select r.id into v_role_id
    from public.roles r
    where r.name = case v_invitation.role when 'ADMIN' then 'Gestor creativo' else 'Diseñador' end;
  end if;

  insert into public.profile_roles (profile_id, role_id, granted_by)
  values (p_user_id, v_role_id, v_invitation.created_by)
  on conflict do nothing;

  -- Casilla antigua: ADMIN si gestiona roles; AGENTE si su rol es de
  -- Agentes, para que `main` no lo tome por diseñador ni le reparta trabajo;
  -- DESIGNER en el resto, como siempre.
  update public.profiles
  set role = case
        when exists (
          select 1 from public.role_permissions rp
          where rp.role_id = v_role_id and rp.permission = 'gestionar_roles'
        ) then 'ADMIN'::public.role_enum
        when public.role_department(v_role_id) = 'agentes' then 'AGENTE'::public.role_enum
        else 'DESIGNER'::public.role_enum
      end,
      kind = 'AGENCIA'
  where id = p_user_id;

  return true;
end;
$$;
