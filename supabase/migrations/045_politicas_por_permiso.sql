-- 045: las políticas preguntan por permiso, y se cierran dos agujeros.
--
-- Cierra el pendiente 8 de docs/estado-y-traspaso.md (cualquiera con sesión
-- podía borrar cualquier diseño) y uno peor, encontrado el 2026-09-16 al
-- inventariar la base: `authenticated` tenía UPDATE sobre `profiles.role` e
-- `is_dev`, y la política dejaba editar la propia fila sin restringir
-- columnas. Un diseñador podía hacerse ADMIN con un PATCH a PostgREST.
--
-- Convive con el código que hoy corre en main: `profiles.role` sigue existiendo
-- y las ocho personas tienen su rol nuevo desde la 044, así que las consultas
-- antiguas pasan las políticas nuevas. Lo único que deja de funcionar en main
-- es «Cambiar rol» de Miembros (escribía `role`), que en preview ya no existe.
--
-- Referencia: pendiente 4 (search_path entrecomillado). handle_new_user se
-- reescribe aquí con `SET search_path = ''`; is_admin se borra en la 046
-- cuando ya no lo use ninguna política.

-- ─── 1. designs: solo el departamento creativo, y todo el departamento ─────
--
-- No hay jerarquía dentro (spec §3): crear, editar, borrar y reasignar lo
-- puede cualquiera de creativo, como decidió la 036. Lo que cambia es que un
-- futbolista, o una cuenta sin roles, no puede nada.

drop policy designs_admin_all on public.designs;
drop policy designs_read_all on public.designs;
drop policy designs_insert on public.designs;
drop policy designs_update_authenticated on public.designs;
drop policy designs_delete_all on public.designs;

create policy designs_creativo_all on public.designs
  for all
  using (public.in_department(auth.uid(), 'creativo'))
  with check (public.in_department(auth.uid(), 'creativo'));

-- ─── 2. profiles: cada uno el suyo; el personal, todos ───────────────────

drop policy profiles_select_all on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select
  using (id = auth.uid() or public.is_staff(auth.uid()));

drop policy profiles_owner_admin_upd on public.profiles;
create policy profiles_update_own_or_manager on public.profiles
  for update
  using (id = auth.uid() or public.has_permission(auth.uid(), 'gestionar_roles'))
  with check (id = auth.uid() or public.has_permission(auth.uid(), 'gestionar_roles'));

-- Columnas: desde el cliente nadie escribe `role`, `kind` ni `is_dev`. Solo
-- las funciones SECURITY DEFINER (use_invitation) tocan `kind`. Es la
-- herramienta de Postgres para esto; una política no distingue columnas.
revoke update on public.profiles from anon, authenticated;
grant update (given_name, family_name, alias, avatar_url, accent_color,
              notification_preferences, weekly_capacity, updated_at)
  on public.profiles to authenticated;

-- ─── 3. invitations: quien tiene el permiso de invitar ────────────────────

drop policy "Admins can view all invitations" on public.invitations;
drop policy "Admins can create invitations" on public.invitations;
drop policy "Admins can update invitations" on public.invitations;
drop policy "Admins can delete invitations" on public.invitations;

create policy invitations_select_inviters on public.invitations
  for select using (public.has_permission(auth.uid(), 'invitar_personal'));
create policy invitations_insert_inviters on public.invitations
  for insert with check (public.has_permission(auth.uid(), 'invitar_personal') and created_by = auth.uid());
create policy invitations_update_inviters on public.invitations
  for update
  using (public.has_permission(auth.uid(), 'invitar_personal'))
  with check (public.has_permission(auth.uid(), 'invitar_personal'));
create policy invitations_delete_inviters on public.invitations
  for delete using (public.has_permission(auth.uid(), 'invitar_personal'));

drop policy "Admins can view all invitation uses" on public.invitation_uses;
create policy invitation_uses_select_inviters on public.invitation_uses
  for select using (public.has_permission(auth.uid(), 'invitar_personal'));

-- ─── 4. audit_log y notifications ─────────────────────────────────────────

drop policy audit_admin_sel on public.audit_log;
create policy audit_log_select_managers on public.audit_log
  for select using (public.has_permission(auth.uid(), 'gestionar_roles'));

drop policy audit_log_insert on public.audit_log;
create policy audit_log_insert_staff on public.audit_log
  for insert with check (public.is_staff(auth.uid()));

-- Misma semántica que la 028, dicha con el permiso: insertar un aviso a otra
-- persona lo puede quien gestiona roles. NO se abre a todo creativo aunque
-- tiente: cada fila de `notifications` dispara correo y push a su destinatario
-- (triggers on_notification_insert y trigger_notify_on_push), así que abrirlo
-- sería dejar que cualquier diseñador mande correos con el enlace que quiera
-- a cualquier compañero. Lo que se pierde es lo mismo que hoy: un diseñador
-- que crea un lote no genera el aviso agregado (la 028 ya lo bloqueaba).
drop policy notifications_insert_admin on public.notifications;
create policy notifications_insert_managers on public.notifications
  for insert with check (public.has_permission(auth.uid(), 'gestionar_roles'));

-- ─── 5. handle_new_user: crea el perfil, no decide qué es ─────────────────
--
-- Sin `role`: mientras exista la columna la rellena su valor por defecto; el
-- rol de verdad lo da use_invitation. Y con el search_path bien escrito.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, given_name, family_name, alias)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'given_name'), ''),
      nullif(btrim(split_part(new.raw_user_meta_data->>'full_name', ' ', 1)), ''),
      'Usuario'
    ),
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'family_name'), ''),
      nullif(btrim(split_part(new.raw_user_meta_data->>'full_name', ' ', 2)), '')
    ),
    nullif(btrim(new.raw_user_meta_data->>'alias'), '')
  );
  return new;
end;
$function$;
