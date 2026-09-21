-- 046: la ficha del jugador, sus archivos y el cubo donde viven.
--
-- Puntos 2, 3 y 4 del spec (§5 carpetas, §7 y §9 almacén, §8 ficha y alta).
-- Plan: docs/superpowers/plans/2026-09-17-jugadores-carpetas-y-almacen.md
--
-- Solo añade. Producción (`main`) no conoce nada de esto y sigue igual. Da por
-- aplicada la 045: las políticas de `invitations` que sustituye son las de la
-- 045, así que va después de ella.
--
-- Las carpetas NO tienen tabla: son fijas y las mismas para todos (spec §5),
-- y las dice el código (lib/utils/players.ts). Un archivo sin carpeta es un
-- envío del jugador que la agencia todavía no ha colocado: eso es «Enviados».
--
-- Revisada con contexto limpio el 2026-09-17 antes de aplicarse; de ahí salen
-- el valor JUGADOR del enum antiguo, las restricciones de ruta en
-- player_files, la guardia de p_user_id en use_invitation y la regla de
-- borrado del cubo atada al id del archivo.

-- ─── 0. La casilla antigua tiene que poder decir «jugador» ────────────────
--
-- `main` (producción, misma base) sigue leyendo `profiles.role` y trata a
-- todo DESIGNER como diseñador: lo lista en Equipo y le reparte diseños. Un
-- jugador no puede nacer DESIGNER ni un segundo. El valor nuevo no se puede
-- usar en la misma transacción que lo crea; por eso aquí solo aparece dentro
-- de cuerpos de función, que se evalúan al ejecutarse. Se va con la 049 (la
-- que borra lo antiguo del rol; era «047» cuando se escribió esto).

alter type public.role_enum add value if not exists 'JUGADOR';

-- ─── 1. players: la ficha, que existe antes que la cuenta ────────────────

create table public.players (
  id uuid primary key default gen_random_uuid(),
  given_name text not null check (btrim(given_name) <> ''),
  family_name text,
  full_name text generated always as (btrim(given_name || ' ' || coalesce(family_name, ''))) stored,
  active boolean not null default true,
  -- Nula hasta que acepte el enlace; única porque una cuenta es de una ficha.
  profile_id uuid unique references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

alter table public.players enable row level security;

-- Todo el departamento creativo gestiona las fichas (spec §5), sin subconjuntos.
create policy players_creativo_all on public.players
  for all
  using (public.in_department(auth.uid(), 'creativo'))
  with check (public.in_department(auth.uid(), 'creativo'));

-- El jugador ve su propia ficha y nada más.
create policy players_select_own on public.players
  for select
  using (profile_id = auth.uid());

-- La ficha de quien llama, o nula si no es un jugador con cuenta. SECURITY
-- DEFINER para que las políticas de abajo (y las del cubo) no tengan que
-- pasar por la RLS de `players` otra vez.
create function public.own_player_id(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.players p where p.profile_id = uid limit 1;
$$;
revoke execute on function public.own_player_id(uuid) from public, anon;
grant execute on function public.own_player_id(uuid) to authenticated, service_role;

-- ─── 2. player_files: entregas y envíos son la misma clase de archivo ──────

create table public.player_files (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  -- Nula = lo mandó el jugador y nadie lo ha colocado aún. Los valores válidos
  -- («fotos», «matchdays») los fija el código, no la base.
  folder text check (folder is null or btrim(folder) <> ''),
  -- Rótulo de la entrega («Jornada 12»). Es un rótulo, NO una subcarpeta.
  batch text,
  name text not null check (btrim(name) <> ''),
  -- Ruta dentro del cubo `jugadores`: {player_id}/{id}.{ext} (spec §9).
  storage_path text not null unique,
  -- Miniatura JPEG hecha en el navegador al subir; nula para vídeos.
  thumb_path text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- La ruta va atada a la fila: {player_id}/{id}.{ext} y {player_id}/{id}.thumb.jpg.
  -- Sin esto un jugador podía crear una fila suya apuntando a un objeto ajeno
  -- y borrarlo con la regla del cubo (hallazgo de la revisión del 2026-09-17).
  constraint player_files_path_matches_row
    check (storage_path like player_id::text || '/' || id::text || '.%'),
  constraint player_files_thumb_matches_row
    check (thumb_path is null or thumb_path = player_id::text || '/' || id::text || '.thumb.jpg')
);

create index player_files_player_folder_idx
  on public.player_files (player_id, folder, created_at desc);

alter table public.player_files enable row level security;

-- La agencia: todo. Mover un archivo es cambiarle la carpeta, y eso solo lo
-- hace ella (spec §5: «el archivador lo lleva la agencia»).
create policy player_files_creativo_all on public.player_files
  for all
  using (public.in_department(auth.uid(), 'creativo'))
  with check (public.in_department(auth.uid(), 'creativo'));

-- El jugador: ve lo suyo, sube solo a «Enviados» (sin carpeta) y a su nombre,
-- y borra solo lo que mandó él mientras nadie lo haya colocado. No hay
-- política de UPDATE para él: no mueve, no renombra.
create policy player_files_select_own on public.player_files
  for select
  using (player_id = public.own_player_id(auth.uid()));

create policy player_files_insert_own on public.player_files
  for insert
  with check (
    player_id = public.own_player_id(auth.uid())
    and folder is null
    and uploaded_by = auth.uid()
  );

create policy player_files_delete_own_unplaced on public.player_files
  for delete
  using (
    player_id = public.own_player_id(auth.uid())
    and uploaded_by = auth.uid()
    and folder is null
  );

-- ─── 3. invitations: una invitación de jugador lleva ficha, no rol ─────────

alter table public.invitations
  add column player_id uuid references public.players(id) on delete cascade;

alter table public.invitations
  add constraint invitations_role_or_player check (role_id is null or player_id is null);

create index invitations_player_id_idx on public.invitations (player_id);

-- Las cuatro de la 045, ahora con dos permisos: `invitar_personal` para las
-- de rol, `invitar_jugadores` para las de ficha (spec §8).
drop policy if exists invitations_select_inviters on public.invitations;
drop policy if exists invitations_insert_inviters on public.invitations;
drop policy if exists invitations_update_inviters on public.invitations;
drop policy if exists invitations_delete_inviters on public.invitations;

create policy invitations_select_inviters on public.invitations
  for select using (
    (player_id is null and public.has_permission(auth.uid(), 'invitar_personal'))
    or (player_id is not null and public.has_permission(auth.uid(), 'invitar_jugadores'))
  );
create policy invitations_insert_inviters on public.invitations
  for insert with check (
    created_by = auth.uid()
    and (
      (player_id is null and public.has_permission(auth.uid(), 'invitar_personal'))
      or (player_id is not null and public.has_permission(auth.uid(), 'invitar_jugadores'))
    )
  );
create policy invitations_update_inviters on public.invitations
  for update
  using (
    (player_id is null and public.has_permission(auth.uid(), 'invitar_personal'))
    or (player_id is not null and public.has_permission(auth.uid(), 'invitar_jugadores'))
  )
  with check (
    (player_id is null and public.has_permission(auth.uid(), 'invitar_personal'))
    or (player_id is not null and public.has_permission(auth.uid(), 'invitar_jugadores'))
  );
create policy invitations_delete_inviters on public.invitations
  for delete using (
    (player_id is null and public.has_permission(auth.uid(), 'invitar_personal'))
    or (player_id is not null and public.has_permission(auth.uid(), 'invitar_jugadores'))
  );

-- ─── 4. get_invitation_by_token v3: dice de quién es la ficha ─────────────
--
-- Cambia lo que devuelve, así que hay que borrarla y crearla (y volver a dar
-- los permisos, que se van con ella). Una invitación de jugador deja de ser
-- válida en cuanto la ficha tiene cuenta, aunque no se haya «usado».

drop function public.get_invitation_by_token(text);

create function public.get_invitation_by_token(p_token text)
returns table (id uuid, role text, role_name text, player_id uuid, player_name text, valid boolean)
language sql
security definer
set search_path = ''
as $function$
  select i.id,
         i.role::text,
         r.name,
         i.player_id,
         pl.full_name,
         ((i.expires_at is null or i.expires_at > now())
           and (select count(*) from public.invitation_uses u where u.invitation_id = i.id) < i.max_uses
           and (i.player_id is null or pl.profile_id is null)) as valid
  from public.invitations i
  left join public.roles r on r.id = i.role_id
  left join public.players pl on pl.id = i.player_id
  where i.token = p_token;
$function$;

revoke execute on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated, service_role;

-- ─── 5. use_invitation v3: la cuenta del jugador nace enganchada a la ficha ─

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

-- ─── 5b. handle_new_user v3: el jugador nace jugador, no diseñador ─────────
--
-- Entre el alta y use_invitation pasan segundos, pero si use_invitation falla
-- el perfil se queda como nació. Con el defecto (DESIGNER/AGENCIA), `main` lo
-- listaba en Equipo y le repartía diseños. La pantalla de alta de jugador
-- manda `kind: 'JUGADOR'` en los metadatos, y aquí se respeta: quien se lo
-- ponga sin invitación solo consigue una cuenta que no puede nada. Sigue
-- siendo la misma función de la 045, con ese detalle más.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_player boolean := coalesce(new.raw_user_meta_data->>'kind', '') = 'JUGADOR';
begin
  insert into public.profiles (id, given_name, family_name, alias, kind, role)
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
    nullif(btrim(new.raw_user_meta_data->>'alias'), ''),
    case when v_player then 'JUGADOR'::public.account_kind else 'AGENCIA'::public.account_kind end,
    case when v_player then 'JUGADOR'::public.role_enum else 'DESIGNER'::public.role_enum end
  );
  return new;
end;
$function$;

-- ─── 6. El cubo `jugadores` (spec §9) ─────────────────────────────────────
--
-- Privado: nada se sirve por URL pública; se descarga con URL firmada. 50 MB
-- por archivo es el techo del plan gratuito. Imágenes y vídeos, que es lo que
-- manda un chaval desde el móvil; HEIC porque es lo que hace el iPhone.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jugadores',
  'jugadores',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

-- Las rutas son {player_id}/{archivo}: el primer tramo dice de quién es.
create policy jugadores_creativo_all on storage.objects
  for all
  using (bucket_id = 'jugadores' and public.in_department(auth.uid(), 'creativo'))
  with check (bucket_id = 'jugadores' and public.in_department(auth.uid(), 'creativo'));

create policy jugadores_select_own on storage.objects
  for select
  using (
    bucket_id = 'jugadores'
    and (storage.foldername(name))[1] = public.own_player_id(auth.uid())::text
  );

create policy jugadores_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'jugadores'
    and (storage.foldername(name))[1] = public.own_player_id(auth.uid())::text
  );

-- Borrar el objeto exige que su fila siga sin colocar y sea suya: por eso la
-- app borra primero el objeto del cubo y después la fila, nunca al revés. La
-- fila se busca por la ruta misma (jugador del primer tramo, id del archivo
-- del nombre), no por coincidencia de columnas: así no vale una fila falsa.
--
-- OJO: tal como está aquí abajo, esta política estaba MUERTA. Dentro del
-- `exists`, `name` sin cualificar se ata a `f.name` (player_files también
-- tiene esa columna), no a `storage.objects.name`. La 048 la sustituye con
-- el nombre cualificado y endurece la de subida. Se deja como se aplicó,
-- porque el registro de Supabase es este.
create policy jugadores_delete_own_unplaced on storage.objects
  for delete
  using (
    bucket_id = 'jugadores'
    and (storage.foldername(name))[1] = public.own_player_id(auth.uid())::text
    and exists (
      select 1
      from public.player_files f
      where f.player_id::text = (storage.foldername(name))[1]
        and f.id::text = split_part(storage.filename(name), '.', 1)
        and (f.storage_path = name or f.thumb_path = name)
        and f.folder is null
        and f.uploaded_by = auth.uid()
    )
  );
