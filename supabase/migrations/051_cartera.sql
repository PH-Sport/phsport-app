-- 051: la cartera de Agentes entra en la base.
--
-- Fase 2 del campograma dentro de la app. Spec:
-- docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md (§1, §2, §3, §5, §6).
-- Plan: docs/superpowers/plans/2026-10-12-campograma-fase-2-cartera.md.
--
-- SOLO AÑADE: tres tablas, un permiso para Director, dos triggers y una
-- consulta para creativo. Producción (`main`) no lee nada de esto.
--
-- SIN DATOS DE JUGADORES. Este repositorio es público y la cartera tiene
-- menores: las categorías van aquí porque no son de nadie; los jugadores y el
-- entrenador se cargan aparte, una vez, desde campograma-ph (plan, tarea 4).

-- ─── 1. Categorías ────────────────────────────────────────────────────────
--
-- La lista se cambia por migración, como los roles; sin pantalla (spec §6).
-- El id es la clave del campograma suelto, para que la carga no traduzca nada.
-- RFEF se llama «RFEF» a secas, sin desglosar 1ª, 2ª y 3ª (spec §6).

create table public.portfolio_categories (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null check (btrim(name) <> ''),
  short_name text not null check (btrim(short_name) <> ''),
  coach text check (coach is null or btrim(coach) <> ''),
  sort_order smallint not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_portfolio_categories_updated_at
  before update on public.portfolio_categories
  for each row execute function public.set_updated_at();

insert into public.portfolio_categories (id, name, short_name, sort_order) values
  ('elite', '1ª / 2ªA / Internacional', '1ª · 2ªA · Intl', 1),
  ('rfef', 'RFEF', 'RFEF', 2),
  ('cantera', 'Cantera', 'Cantera', 3),
  ('sinconfirmar', 'Sin confirmar', 'Sin confirmar', 4);

-- ─── 2. Jugadores de la cartera ───────────────────────────────────────────
--
-- Tabla propia, separada de `players` (las fichas de creativo, spec §1). El
-- enlace a esa ficha queda vacío por ahora: juntarlas algún día será rellenar
-- este hueco, no migrar datos. No hay unicidad por nombre: hay apellidos
-- repetidos que son personas distintas.
--
-- Vacío = «sin confirmar» en año y club; no se rellena nada por el camino.
-- Las once demarcaciones son las del campograma, fijas (spec §6).
-- La baja no borra: guarda fecha, motivo y quién (spec §5). Nadie borra filas.

create table public.portfolio_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  birth_year smallint check (birth_year between 1930 and 2030),
  owner_club text check (owner_club is null or btrim(owner_club) <> ''),
  situation text check (situation in ('loaned', 'pending')),
  loaned_to text check (loaned_to is null or btrim(loaned_to) <> ''),
  position text not null
    check (position in ('POR', 'DFCI', 'DFCD', 'LI', 'LD', 'MC', 'MCOI', 'MCOD', 'EI', 'ED', 'DEL')),
  category_id text not null references public.portfolio_categories(id) on delete restrict,
  photo_url text check (photo_url is null or btrim(photo_url) <> ''),
  division text check (division is null or btrim(division) <> ''),
  creative_player_id uuid references public.players(id) on delete set null,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete set null,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- «Cedido a» solo con situación «cedido», y siempre con ella. `is not
  -- distinct from` y no `=`: con `situation` nula, `=` daría nulo y un CHECK
  -- nulo deja pasar cualquier cosa.
  constraint portfolio_players_loaned_to_only_when_loaned
    check ((situation is not distinct from 'loaned') = (loaned_to is not null)),
  -- De baja = fecha y motivo; activo = nada de las tres. `deactivated_by`
  -- puede quedar nulo si se borra la cuenta de quien dio la baja.
  constraint portfolio_players_deactivation_complete
    check (
      (deactivated_at is null and deactivated_by is null and deactivation_reason is null)
      or (deactivated_at is not null and btrim(coalesce(deactivation_reason, '')) <> '')
    )
);

create index portfolio_players_category_id_idx on public.portfolio_players (category_id);

create trigger trg_portfolio_players_updated_at
  before update on public.portfolio_players
  for each row execute function public.set_updated_at();

-- ─── 3. Baja y recuperación: solo con permiso, y la base apunta quién ────
--
-- La RLS no distingue columnas: un agente puede actualizar la fila entera,
-- así que la baja se guarda en un trigger. Además, las fechas y el autor de la
-- baja los pone la base: nadie firma una baja a nombre de otro, ni se queda con
-- la de otro director, ni antedata un alta. Sin sesión (auth.uid() nulo) solo
-- llega quien ya se salta la RLS —postgres y service_role—: la carga inicial,
-- el mantenimiento a mano y el `on delete set null` al borrar una cuenta.

create function public.guard_portfolio_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.deactivated_at is not null or new.deactivated_by is not null or new.deactivation_reason is not null then
      raise exception 'Un jugador entra en la cartera activo' using errcode = 'check_violation';
    end if;
    if auth.uid() is not null then
      new.created_at := now();
      new.updated_at := now();
    end if;
    return new;
  end if;

  if auth.uid() is not null then
    -- Lo que no decide quien edita: cuándo nació la fila, y cuándo y quién dio
    -- la baja. Así un director no reasigna la baja de otro sin rastro, y el
    -- formulario puede reenviar la fecha de baja con otra precisión (el
    -- navegador va en milisegundos, Postgres en microsegundos) sin que parezca
    -- que la toca: editar el nombre de un jugador de baja no pide permiso.
    new.created_at := old.created_at;
    new.deactivated_at := case when new.deactivated_at is not null then coalesce(old.deactivated_at, now()) end;
    new.deactivated_by := old.deactivated_by;
  end if;

  if (new.deactivated_at, new.deactivated_by, new.deactivation_reason)
       is not distinct from (old.deactivated_at, old.deactivated_by, old.deactivation_reason) then
    return new;
  end if;

  if auth.uid() is not null and not public.has_permission(auth.uid(), 'dar_de_baja_jugadores') then
    raise exception 'Solo un director puede dar de baja o recuperar a un jugador'
      using errcode = 'insufficient_privilege';
  end if;

  if new.deactivated_at is not null then
    -- Baja, o cambio de motivo de una baja: la fecha es la primera, el autor
    -- es quien lo hace.
    new.deactivated_at := coalesce(old.deactivated_at, now());
    new.deactivated_by := coalesce(auth.uid(), new.deactivated_by);
  else
    -- Recuperación: no queda rastro en la fila; el rastro está en el historial.
    new.deactivated_by := null;
    new.deactivation_reason := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_portfolio_deactivation() from public, anon, authenticated;

create trigger trg_portfolio_players_guard
  before insert or update on public.portfolio_players
  for each row execute function public.guard_portfolio_deactivation();

-- ─── 4. Historial: qué, quién y cuándo, con el valor anterior y el nuevo ─
--
-- `audit_log` es de diseños y solo lo lee quien gestiona roles; la cartera
-- lleva el suyo, legible por todo Agentes (spec, «Lo que hay que cambiar», 5).
-- Lo escribe solo el trigger: ningún cliente puede insertar ni tocar filas.
-- `actor_id` nulo = sin sesión (la carga inicial o un arreglo a mano) o una
-- cuenta ya borrada (`on delete set null`): la pantalla no debe rotular el
-- nulo como «carga inicial»; para eso está la fecha.

create table public.portfolio_changes (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.portfolio_players(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('create', 'update', 'deactivate', 'reactivate')),
  changes jsonb not null,
  created_at timestamptz not null default now()
);

create index portfolio_changes_player_id_idx on public.portfolio_changes (player_id, created_at desc);

-- SECURITY DEFINER porque quien edita no puede escribir en `portfolio_changes`
-- (sección 6). `changes` = {campo: {"old": …, "new": …}} solo con los campos
-- que cambian; `updated_at` y la fecha y el autor de la baja no cuentan, los
-- dicen la acción, el actor y `created_at`.

create function public.log_portfolio_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tracked constant text[] := array[
    'name', 'birth_year', 'owner_club', 'situation', 'loaned_to', 'position',
    'category_id', 'photo_url', 'division', 'creative_player_id', 'deactivation_reason'
  ];
  v_changes jsonb;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', 'null'::jsonb, 'new', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(to_jsonb(new)) as n
      where n.key = any (v_tracked) and n.value <> 'null'::jsonb;
  else
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(to_jsonb(new)) as n
      join jsonb_each(to_jsonb(old)) as o on o.key = n.key
      where n.key = any (v_tracked) and n.value is distinct from o.value;
    -- Guardar la ficha sin cambiar nada no ensucia el historial.
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    v_action := case
      when old.deactivated_at is null and new.deactivated_at is not null then 'deactivate'
      when old.deactivated_at is not null and new.deactivated_at is null then 'reactivate'
      else 'update'
    end;
  end if;

  insert into public.portfolio_changes (player_id, actor_id, action, changes)
  values (new.id, auth.uid(), v_action, v_changes);
  return null;
end;
$$;
revoke execute on function public.log_portfolio_change() from public, anon, authenticated;

create trigger trg_portfolio_players_log
  after insert or update on public.portfolio_players
  for each row execute function public.log_portfolio_change();

-- ─── 5. Director da de baja y recupera ────────────────────────────────────
--
-- El agente no trae permisos: ver, dar de alta y editar es del departamento
-- entero (políticas de abajo). Dar de baja y recuperar, solo Director (spec §2).

insert into public.role_permissions (role_id, permission)
select r.id, 'dar_de_baja_jugadores'
from public.roles r
where r.name = 'Director';

-- ─── 6. Quién ve y quién escribe ──────────────────────────────────────────
--
-- Los privilegios por defecto del esquema dan todo a anon y a authenticated, y
-- la RLS es la que cierra. Con menores dentro se cierra también la puerta: se
-- retira todo y authenticated recibe solo lo que hace la app. Todo de golpe y
-- no quitando de uno en uno, porque «todo» incluye cosas que se olvidan:
-- TRUNCATE se salta la RLS, y en Postgres 17 también va MAINTAIN.

alter table public.portfolio_categories enable row level security;
alter table public.portfolio_players enable row level security;
alter table public.portfolio_changes enable row level security;

revoke all on public.portfolio_categories, public.portfolio_players, public.portfolio_changes
  from anon, authenticated;
-- Las categorías cambian por migración y el historial lo escribe el trigger:
-- de las dos, solo lectura. De los jugadores, leer, dar de alta y editar;
-- nadie borra, la baja es una marca (sección 3).
grant select on public.portfolio_categories, public.portfolio_changes to authenticated;
grant select, insert, update on public.portfolio_players to authenticated;

create policy portfolio_categories_select_agentes on public.portfolio_categories
  for select to authenticated
  using (public.in_department(auth.uid(), 'agentes'));

create policy portfolio_players_select_agentes on public.portfolio_players
  for select to authenticated
  using (public.in_department(auth.uid(), 'agentes'));

create policy portfolio_players_insert_agentes on public.portfolio_players
  for insert to authenticated
  with check (public.in_department(auth.uid(), 'agentes'));

create policy portfolio_players_update_agentes on public.portfolio_players
  for update to authenticated
  using (public.in_department(auth.uid(), 'agentes'))
  with check (public.in_department(auth.uid(), 'agentes'));

create policy portfolio_changes_select_agentes on public.portfolio_changes
  for select to authenticated
  using (public.in_department(auth.uid(), 'agentes'));

-- ─── 7. Lo que ve creativo: nombre y equipo actual, nada más ─────────────
--
-- Para autocompletar al crear diseños (spec §7, fase 5). El equipo actual es
-- el de la cesión si está cedido, y si no, el propietario: la camiseta que sale
-- en el diseño (spec §3). SECURITY DEFINER porque creativo no lee la tabla; la
-- función es la única puerta y solo devuelve esas dos columnas de los activos.
-- Equipo nulo = club sin confirmar.

create function public.portfolio_names()
returns table (name text, team text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name,
         case when p.situation = 'loaned' then p.loaned_to else p.owner_club end
  from public.portfolio_players p
  where p.deactivated_at is null
    and public.in_department(auth.uid(), 'creativo')
  order by p.name;
$$;
revoke execute on function public.portfolio_names() from public, anon;
grant execute on function public.portfolio_names() to authenticated;
