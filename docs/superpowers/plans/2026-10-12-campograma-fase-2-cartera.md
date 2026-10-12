# Campograma, fase 2: la cartera en la base — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos llevan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que la cartera de jugadores de Agentes viva en la base de la app, con sus categorías y su historial, protegida por departamento, con la consulta de nombre y equipo que necesita creativo y con los 165 jugadores del campograma suelto cargados.

**Arquitectura:** una migración que solo añade tres tablas (`portfolio_categories`, `portfolio_players`, `portfolio_changes`), sus políticas, una guardia para la baja, un trigger que escribe el historial y una función `portfolio_names()` para creativo. Los datos de los jugadores **no** van en la migración: se cargan una vez, aparte, desde el JSON de `campograma-ph`. En el código solo cambia la lista de permisos.

**Stack:** Supabase (Postgres 17 + RLS) · TypeScript · vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md` (§1, §2, §3, §5, §6 y «Orden de trabajo», punto 2). La fase 1 está en `docs/superpowers/plans/2026-10-11-campograma-fase-1-agentes.md` y en el §1 de octubre de `docs/estado-y-traspaso.md`.

## Restricciones globales

- Rama `feat/cartera`, en la carpeta `.claude/worktrees/cartera` del repo, salida de `preview` en `5d1c860`. La carpeta principal no se toca: puede haber otra sesión trabajando en ella.
- **No se hace commit ni push salvo que Mario lo pida** (`CLAUDE.md`). Los pasos «Commit» se ejecutan solo con esa autorización.
- **La base es la de producción.** La migración solo añade y **se aplica únicamente con permiso expreso de Mario**. La carga de jugadores, también. Cualquier prueba que escriba en la base, aunque se deshaga, va incluida en ese permiso y se dice al pedirlo.
- **Este repositorio es público en GitHub y la cartera tiene menores** (59 nacidos en 2008 o después). Ningún nombre, año ni club de un jugador entra en un archivo versionado: ni en la migración, ni en tests, ni en este plan, ni en la documentación. Lo que se genera para la carga vive fuera del repo (el scratchpad de la sesión) y no se commitea.
- La migración es la **051**. El número 049 está reservado para la que borra el rol antiguo tras el merge a `main` (pendiente 11 de `estado-y-traspaso.md`).
- Nombres de tablas y columnas en inglés; comentarios, mensajes de error y textos, en castellano. Los comentarios explican por qué.
- Nunca comparar nombres de rol en código (regla `permisos.md`). El permiso nuevo se define en `lib/utils/access.ts`.
- Sin dependencias nuevas. Sin pantallas: el campograma llega en la fase 3.
- Después de cada tarea con código: `npx tsc --noEmit`, `npm run lint` y `npm test` en verde, y contarlo antes de seguir.

## Foco de revisión

Casos que el spec implica y que ningún test obvio cubre; cada uno tiene su comprobación en la tarea que lo posee.

1. **Un agente (no director) que da de baja a un jugador con una petición directa a la base**, sin pasar por la app: la RLS deja actualizar la fila, así que tiene que pararlo la guardia. → Sesión simulada en la tarea 5.
2. **Una cuenta de creativo que pide la tabla de la cartera directamente**, o que intenta sacar más que nombre y equipo de `portfolio_names()`: cero filas en las tablas y solo dos columnas en la función. → Sesión simulada en la tarea 5.
3. **Guardar la ficha sin cambiar nada** (el formulario de la fase 4 lo hará a menudo): no puede llenar el historial de entradas vacías. → Sesión simulada en la tarea 5.
4. **Alguien que firma la baja a nombre de otro** (manda `deactivated_by` con el uuid de otra persona): la base apunta a quien la hace de verdad. → Sesión simulada en la tarea 5.
5. **Cargar dos veces** (la carga se repite por error, o se relanza tras un fallo a medias): no puede duplicar la cartera. → Guardia en el SQL de la carga, tarea 4, y la carga va entera o no va.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `lib/utils/access.ts` | Permiso nuevo `dar_de_baja_jugadores` |
| `lib/utils/access.test.ts` | Sus tests |
| `supabase/migrations/051_cartera.sql` (nuevo) | Tablas, guardia, historial, políticas, permiso de Director y `portfolio_names()` |
| `docs/estado-y-traspaso.md` | §2 de octubre y pendientes |
| `docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md` | Línea de estado |
| `.claude/rules/permisos.md`, `.claude/rules/migraciones.md`, `CLAUDE.md` | El permiso de la cartera, y que en este repo no entran datos de jugadores |

Fuera del repo, y sin versionar: el SQL de la carga, generado en el scratchpad de la sesión a partir de `~/Developer/campograma-ph/data/jugadores.json`.

---

### Tarea 0: Preparar la carpeta de trabajo

**Archivos:** ninguno versionado.

La carpeta `.claude/worktrees/cartera` ya existe (creada el 2026-10-12 con `git worktree add -b feat/cartera .claude/worktrees/cartera preview`), con `node_modules` y `.env.local` enlazados desde la carpeta principal.

- [ ] **Paso 1: comprobar que está limpia y enlazada**

```bash
cd /Users/rodz/Developer/phsport-app/.claude/worktrees/cartera
git branch --show-current
git status --short
ls -la node_modules .env.local | cut -c1-10
```

Esperado: `feat/cartera`; `git status` vacío salvo este plan sin commitear; los dos enlaces existen. Si no existen: `ln -s ../../../node_modules node_modules` y `ln -s ../../../.env.local .env.local` (no se copian: el `.env.local` lleva claves y no se imprime).

- [ ] **Paso 2: línea base**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Esperado: todo en verde, 216 tests (la cifra del 2026-10-12, tras integrar la fase 1).

---

### Tarea 1: El permiso de dar de baja, en el código

**Archivos:**
- Modificar: `lib/utils/access.ts` (lista `PERMISSIONS`)
- Test: `lib/utils/access.test.ts`

**Interfaces:**
- Produce: el permiso `'dar_de_baja_jugadores'` dentro del tipo `Permission`. La fase 4 lo usará con `access.can('dar_de_baja_jugadores')`; la tarea 2 se lo da al rol Director en la base.

Sin él, `normalizeProfile` descarta el permiso al leer los roles («un permiso que no existe en PERMISSIONS no puede dar acceso a nada»), y la app no sabría que un director puede dar de baja.

- [ ] **Paso 1: test que falla**

Añadir al final de `lib/utils/access.test.ts`:

```ts
describe('la cartera', () => {
  const directorConBaja = {
    ...director,
    permissions: [...director.permissions, 'dar_de_baja_jugadores'] as const,
  };

  it('normalizeProfile conserva el permiso de dar de baja jugadores', () => {
    const raw = {
      ...base,
      profile_roles: [
        {
          role: {
            id: 'r4',
            name: 'Director',
            department: 'agentes',
            role_permissions: [{ permission: 'dar_de_baja_jugadores' }],
          },
        },
      ],
    };
    expect(normalizeProfile(raw).roles[0].permissions).toEqual(['dar_de_baja_jugadores']);
  });

  it('solo quien tiene el permiso puede dar de baja; ser de Agentes no basta', () => {
    expect(deriveAccess({ ...base, roles: [directorConBaja] }).can('dar_de_baja_jugadores')).toBe(true);
    expect(deriveAccess({ ...base, roles: [agente] }).can('dar_de_baja_jugadores')).toBe(false);
    expect(deriveAccess({ ...base, roles: [gestor] }).can('dar_de_baja_jugadores')).toBe(false);
  });
});
```

- [ ] **Paso 2: comprobar que falla**

Run: `npx vitest run lib/utils/access.test.ts`
Expected: FAIL en «normalizeProfile conserva el permiso…» (`[]` en vez de `['dar_de_baja_jugadores']`). `npx tsc --noEmit` también falla: el literal no es un `Permission`.

- [ ] **Paso 3: añadir el permiso**

En `lib/utils/access.ts`, al final de `PERMISSIONS`:

```ts
  'invitar_agentes',
  'gestionar_agentes',
  // Dar de baja y recuperar jugadores de la cartera. Solo Director (spec §2):
  // un agente da de alta y edita, pero no saca a nadie del campograma.
  'dar_de_baja_jugadores',
] as const;
```

- [ ] **Paso 4: comprobar que pasa**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: todo en verde, 218 tests.

- [ ] **Paso 5: commit (solo con permiso de Mario)**

```bash
git add lib/utils/access.ts lib/utils/access.test.ts
git commit -m "feat(cartera): la app conoce el permiso de dar de baja jugadores"
```

---

### Tarea 2: La migración 051 (escribirla, no aplicarla)

**Archivos:**
- Crear: `supabase/migrations/051_cartera.sql`

**Interfaces:**
- Consume: `public.in_department(uid uuid, dept text)` y `public.has_permission(uid uuid, perm text)` (044), `public.set_updated_at()` (trigger existente), `public.players(id)` (046), el rol `Director` (050).
- Produce, para las fases 3 a 5:
  - `public.portfolio_categories (id text pk, name, short_name, coach, sort_order)`, ids `elite`, `rfef`, `cantera`, `sinconfirmar`.
  - `public.portfolio_players (id uuid pk, name, birth_year, owner_club, situation 'loaned'|'pending'|null, loaned_to, position, category_id, photo_url, division, creative_player_id, deactivated_at, deactivated_by, deactivation_reason, created_at, updated_at)`.
  - `public.portfolio_changes (id, player_id, actor_id, action 'create'|'update'|'deactivate'|'reactivate', changes jsonb {campo: {old, new}}, created_at)`.
  - `public.portfolio_names() returns table (name text, team text)`.

- [ ] **Paso 1: comprobar el estado vivo antes de escribir** (regla `migraciones.md`: manda la base, no los archivos)

Con el MCP de Supabase (`execute_sql`, solo lectura):

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 2;
select count(*) as tablas_portfolio from information_schema.tables where table_schema = 'public' and table_name like 'portfolio%';
select r.name, array_agg(rp.permission order by rp.permission) from public.roles r
  left join public.role_permissions rp on rp.role_id = r.id where r.department = 'agentes' group by r.name;
```

Esperado: la última aplicada es `agentes_roles_y_permisos`; ninguna tabla `portfolio*`; Director con `{gestionar_agentes,invitar_agentes}` y Agente con `{NULL}`. Y en el repo, `ls supabase/migrations | tail -3` termina en `050_…`. Si algo no cuadra, **parar**.

- [ ] **Paso 2: escribir la migración**

Crear `supabase/migrations/051_cartera.sql` con este contenido exacto:

```sql
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
```

- [ ] **Paso 3: revisión con contexto limpio**

Pedir una revisión de la migración a un subagente de solo lectura, sin esta conversación, con el spec, este plan y las migraciones 044, 046 y 050 delante. Preguntas concretas:

1. ¿Puede un agente sin `dar_de_baja_jugadores`, por PostgREST directo, dar de baja, recuperar o cambiar el motivo de una baja? ¿Y firmarla a nombre de otro?
2. ¿Puede alguien escribir, borrar o reescribir el historial? ¿Queda alguna edición sin rastro?
3. ¿Puede creativo, un jugador (`kind = 'JUGADOR'`) o `anon` leer algo de la cartera aparte de lo que da `portfolio_names()`?
4. ¿Algún `search_path`, `security definer` o `execute` mal puesto? ¿Algún CHECK que un valor nulo deje pasar?
5. ¿Cambia algo para `main` o para las tablas que ya existen?

Los hallazgos se resuelven en el archivo antes de la tarea 3. Si alguno obliga a cambiar el diseño, **parar** y contárselo a Mario.

Hecha el 2026-10-12, y ya incorporada en la migración de arriba. Sin agujeros de permisos ni fugas. Tres mejoras aplicadas:
- la base fija `created_at` y quién y cuándo dio la baja, así que un director no se queda en silencio con la baja de otro y el formulario puede reenviar la fecha con otra precisión;
- los privilegios se retiran todos de golpe y se dan solo los que hace falta (en Postgres 17, «todo» incluye `MAINTAIN`);
- el esperado de `sin_equipo` sale de la base.

Las sesiones de la tarea 5 cubren esos casos.

- [ ] **Paso 4: commit (solo con permiso de Mario)**

```bash
git add supabase/migrations/051_cartera.sql
git commit -m "feat(cartera): migración de la cartera de Agentes, sin aplicar"
```

---

### Tarea 3: Aplicar la 051 y leerla de vuelta (con permiso de Mario)

**Archivos:** ninguno.

- [ ] **Paso 1: pedir permiso**

Contarle a Mario en llano qué crea la 051, que solo añade, y que justo después viene la carga de los 165 jugadores (tarea 4) y las pruebas simuladas que escriben y se deshacen (tarea 5). Un solo «sí» para las tres, dicho así. **Sin un sí explícito, la tarea se queda aquí.**

- [ ] **Paso 2: foto de los avisos de seguridad**

`get_advisors` con `type: security`. Anotar cuántos hay de cada clase; es la referencia del paso 4.

- [ ] **Paso 3: aplicar**

`apply_migration` con nombre `cartera` y el contenido exacto de `supabase/migrations/051_cartera.sql`. La regla de «preguntar siempre» de Claude Code pedirá el clic a Mario.

- [ ] **Paso 4: leer de vuelta**

```sql
select 'categorias' as que, string_agg(id || '=' || name, ' | ' order by sort_order) as valor from public.portfolio_categories
union all select 'director', (select array_agg(rp.permission order by rp.permission)::text from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.name = 'Director')
union all select 'politicas', (select string_agg(tablename || '.' || policyname || ':' || cmd, ', ' order by tablename, policyname) from pg_policies where schemaname = 'public' and tablename like 'portfolio%')
union all select 'rls', (select string_agg(relname || '=' || relrowsecurity, ', ' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname like 'portfolio%' and relkind = 'r')
union all select 'anon ve algo', (select coalesce(string_agg(table_name || ':' || privilege_type, ', '), 'nada') from information_schema.role_table_grants where grantee = 'anon' and table_name like 'portfolio%')
union all select 'authenticated', (select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type) from information_schema.role_table_grants where grantee = 'authenticated' and table_name like 'portfolio%')
union all select 'portfolio_names anon', has_function_privilege('anon', 'public.portfolio_names()', 'execute')::text
union all select 'historial', (select version || ' ' || name from supabase_migrations.schema_migrations order by version desc limit 1);
```

Esperado:
- Las cuatro categorías en orden `elite`, `rfef`, `cantera`, `sinconfirmar`, y RFEF llamada «RFEF».
- Director con `{dar_de_baja_jugadores,gestionar_agentes,invitar_agentes}`.
- Cinco políticas: `portfolio_categories_select_agentes:SELECT`, `portfolio_changes_select_agentes:SELECT`, `portfolio_players_insert_agentes:INSERT`, `portfolio_players_select_agentes:SELECT`, `portfolio_players_update_agentes:UPDATE`.
- RLS activa en las tres; `anon` sin nada; `authenticated` con solo `SELECT` en categorías e historial, y `INSERT`, `SELECT`, `UPDATE` en jugadores.
- `portfolio_names` no ejecutable por `anon`; la última migración registrada es `cartera`.

Y de nuevo `get_advisors` (`security`): esperado, uno más en «funciones privilegiadas que puede ejecutar quien tiene sesión» (`portfolio_names`), del mismo tipo que `has_permission`. Ninguno nuevo de otra clase. Cualquier otra cosa: **parar** y contárselo a Mario.

---

### Tarea 4: Cargar los jugadores del campograma (con el permiso de la tarea 3)

**Archivos:** ninguno versionado. Todo lo de esta tarea vive en el scratchpad de la sesión (`$SCRATCH` abajo) y no se commitea: lleva datos de menores y el repo es público.

- [ ] **Paso 1: que el origen esté guardado**

```bash
cd /Users/rodz/Developer/campograma-ph
git status --short data/
git log --oneline -1 -- data/jugadores.json
```

Esperado: `data/` sin cambios pendientes (spec, «Riesgos», hablaba de altas sin commitear; las tres altas a RFEF ya estaban en `5ac5f57`, del 2026-10-10). Si hay cambios, **parar** y preguntar a Mario: la carga sale de lo que esté guardado.

- [ ] **Paso 2: generar el SQL de la carga fuera del repo**

`$SCRATCH` es el scratchpad de la sesión que ejecuta el plan (lo da el entorno de Claude Code; nunca una carpeta del repo).

```bash
SCRATCH="<scratchpad de la sesión>"
test -d "$SCRATCH" && case "$SCRATCH" in /Users/rodz/Developer/*) echo "NO: está dentro de un repo"; exit 1;; esac
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.env.HOME + "/Developer/campograma-ph/data/jugadores.json", "utf8"));
const jug = JSON.stringify(d.jugadores);
const cat = JSON.stringify(d.categorias.map(c => ({ id: c.id, tecnico: c.tecnico ?? null })));
if (jug.includes("$jug$") || cat.includes("$cat$")) throw new Error("el JSON contiene el delimitador");
const sql = `
-- Carga inicial de la cartera desde campograma-ph (${d.actualizado}). Una sola vez.
do $g$
begin
  if exists (select 1 from public.portfolio_players) then
    raise exception $m$La cartera ya tiene jugadores: la carga inicial solo se hace una vez$m$;
  end if;
end
$g$;

update public.portfolio_categories c
set coach = x.tecnico
from jsonb_to_recordset($cat$${cat}$cat$::jsonb) as x(id text, tecnico text)
where c.id = x.id and x.tecnico is not null;

insert into public.portfolio_players
  (name, birth_year, owner_club, situation, loaned_to, position, category_id, photo_url)
select x.nombre, x.anio, x.club,
       case x.situacion when $s$ces$s$ then $s$loaned$s$ when $s$pte$s$ then $s$pending$s$ end,
       case when x.situacion = $s$ces$s$ then x."cesionA" end,
       x.demarcacion, x.categoria, x.foto
from jsonb_to_recordset($jug$${jug}$jug$::jsonb)
  as x(nombre text, anio smallint, club text, demarcacion text, categoria text, situacion text, "cesionA" text, foto text);
`;
fs.writeFileSync(process.argv[1] + "/carga-cartera.sql", sql);
console.log("bytes:", sql.length, "| jugadores:", d.jugadores.length);
' "$SCRATCH"
```

Esperado: `jugadores: 165`. Las comillas de los literales SQL van con `$s$…$s$` para no pelearse con las comillas simples del `node -e`.

- [ ] **Paso 3: ejecutar la carga**

`execute_sql` con el contenido de `$SCRATCH/carga-cartera.sql`. Va en una sola llamada, así que es una sola transacción: si algo falla, no queda nada a medias. Si falla, **parar** y leer el error; no reintentar a ciegas.

- [ ] **Paso 4: comprobar que la base dice lo mismo que el JSON**

Cifras, en la base:

```sql
select count(*) as total,
       count(*) filter (where category_id = 'elite') as elite,
       count(*) filter (where category_id = 'rfef') as rfef,
       count(*) filter (where category_id = 'cantera') as cantera,
       count(*) filter (where category_id = 'sinconfirmar') as sinconfirmar,
       count(*) filter (where situation = 'loaned') as cedidos,
       count(*) filter (where situation = 'pending') as pendientes,
       count(*) filter (where owner_club is null) as sin_club,
       (select count(*) from public.portfolio_changes where action = 'create' and actor_id is null) as altas_en_historial,
       (select coach is not null from public.portfolio_categories where id = 'elite') as elite_con_entrenador
from public.portfolio_players;
```

Esperado (JSON del 2026-10-10): 165 · 39 · 75 · 48 · 3 · 8 cedidos · 2 pendientes · 9 sin club · 165 altas · `true`.

Y fila a fila, con una huella: el mismo texto canónico en los dos lados, ordenado por bytes.

```bash
node -e '
const crypto = require("crypto");
const j = require(process.env.HOME + "/Developer/campograma-ph/data/jugadores.json").jugadores;
const lines = j.map(p => [p.nombre, p.anio ?? "", p.club ?? "", p.demarcacion, p.categoria, p.situacion ?? "", p.cesionA ?? "", p.foto ?? ""].join("|"));
lines.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
console.log(crypto.createHash("md5").update(lines.join("\n")).digest("hex"));
'
```

```sql
select md5(string_agg(line, E'\n' order by line collate "C")) from (
  select concat_ws('|', name, coalesce(birth_year::text, ''), coalesce(owner_club, ''), position, category_id,
                   case situation when 'loaned' then 'ces' when 'pending' then 'pte' else '' end,
                   coalesce(loaned_to, ''), coalesce(photo_url, '')) as line
  from public.portfolio_players
) t;
```

Esperado: las dos huellas iguales. Si no lo son, **parar**: no se arregla a mano; se cuenta a Mario qué difiere.

---

### Tarea 5: Sesiones simuladas (con el permiso de la tarea 3)

**Archivos:** ninguno.

Cada bloque presta roles a Loren o a Mario, hace lo que haría esa persona por la API y **termina siempre con `raise exception`**: el error deshace todo lo escrito y los resultados vuelven en el mensaje (método del §1 de octubre de `estado-y-traspaso.md`). Lo que tiene que fallar va en su propio `begin … exception … end` para no cortar el resto. Antes, leer los uuid:

```sql
select display_name, is_dev, id from public.profiles where display_name in ('Loren', 'Mario');
select name, id from public.roles where name in ('Agente', 'Director');
```

Y pegarlos en lugar de `<LOREN>`, `<MARIO>`, `<AGENTE>` y `<DIRECTOR>`. **Hay dos «Mario»:** `<MARIO>` es la cuenta real, la de `is_dev = true` y rol Gestor creativo; la otra es la cuenta de agente de prueba que Mario creó el 2026-10-12 (rol Director) y aquí no se usa.

- [ ] **Paso 1: Loren como Agente (solo Agentes)**

```sql
do $$
declare
  loren uuid := '<LOREN>';
  agente uuid := '<AGENTE>';
  mario uuid := '<MARIO>';
  res text := '';
  n bigint;
  pid uuid;
begin
  delete from public.profile_roles where profile_id = loren;
  insert into public.profile_roles (profile_id, role_id) values (loren, agente);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', loren, 'role', 'authenticated')::text, true);

  select count(*) into n from public.portfolio_players; res := res || 've_jugadores=' || n || '; ';
  select count(*) into n from public.portfolio_categories; res := res || 've_categorias=' || n || '; ';
  select count(*) into n from public.portfolio_changes; res := res || 've_historial=' || n || '; ';

  insert into public.portfolio_players (name, position, category_id)
    values ('Prueba Cartera', 'MC', 'cantera') returning id into pid;
  select count(*) into n from public.portfolio_changes where player_id = pid and action = 'create' and actor_id = loren;
  res := res || 'alta_con_rastro=' || n || '; ';

  update public.portfolio_players set owner_club = 'Club Prueba' where id = pid;
  select count(*) into n from public.portfolio_changes
    where player_id = pid and action = 'update' and changes = '{"owner_club": {"old": null, "new": "Club Prueba"}}'::jsonb;
  res := res || 'edicion_con_rastro=' || n || '; ';

  update public.portfolio_players set name = name where id = pid;
  select count(*) into n from public.portfolio_changes where player_id = pid;
  res := res || 'guardar_sin_cambios_deja_historial_en=' || n || '; ';

  begin
    update public.portfolio_players set deactivated_at = now(), deactivation_reason = 'prueba' where id = pid;
    res := res || 'agente_da_baja=PASA(mal); ';
  exception when others then res := res || 'agente_da_baja=falla ' || sqlstate || '; ';
  end;

  begin
    insert into public.portfolio_players (name, position, category_id, deactivated_at, deactivation_reason)
      values ('Prueba Baja', 'MC', 'cantera', now(), 'x');
    res := res || 'alta_ya_de_baja=PASA(mal); ';
  exception when others then res := res || 'alta_ya_de_baja=falla ' || sqlstate || '; ';
  end;

  begin
    update public.portfolio_players set situation = 'loaned' where id = pid;
    res := res || 'cedido_sin_destino=PASA(mal); ';
  exception when others then res := res || 'cedido_sin_destino=falla ' || sqlstate || '; ';
  end;

  begin
    delete from public.portfolio_players where id = pid;
    res := res || 'borrar=PASA(mal); ';
  exception when others then res := res || 'borrar=falla ' || sqlstate || '; ';
  end;

  begin
    insert into public.portfolio_changes (player_id, action, changes) values (pid, 'update', '{}');
    res := res || 'escribir_historial=PASA(mal); ';
  exception when others then res := res || 'escribir_historial=falla ' || sqlstate || '; ';
  end;

  begin
    update public.portfolio_categories set coach = 'x' where id = 'cantera';
    res := res || 'tocar_categorias=PASA(mal); ';
  exception when others then res := res || 'tocar_categorias=falla ' || sqlstate || '; ';
  end;

  update public.portfolio_players set created_at = '2001-01-01' where id = pid;
  select count(*) into n from public.portfolio_players where id = pid and created_at > now() - interval '1 minute';
  res := res || 'fecha_de_alta_intocable=' || n || '; ';

  select count(*) into n from public.portfolio_names(); res := res || 'nombres_para_agente=' || n || '; ';

  raise exception 'RESULTADOS (se deshace todo): %', res;
end $$;
```

Esperado: `ve_jugadores=165`, `ve_categorias=4`, `ve_historial=165`, `alta_con_rastro=1`, `edicion_con_rastro=1`, `guardar_sin_cambios_deja_historial_en=2`, `agente_da_baja=falla 42501`, `alta_ya_de_baja=falla 23514`, `cedido_sin_destino=falla 23514`, `borrar=falla 42501`, `escribir_historial=falla 42501`, `tocar_categorias=falla 42501`, `fecha_de_alta_intocable=1`, `nombres_para_agente=0`.

- [ ] **Paso 2: Loren como Director (baja, firma y recuperación)**

```sql
do $$
declare
  loren uuid := '<LOREN>';
  director uuid := '<DIRECTOR>';
  agente uuid := '<AGENTE>';
  mario uuid := '<MARIO>';
  res text := '';
  n bigint;
  pid uuid;
  quien uuid;
begin
  delete from public.profile_roles where profile_id = loren;
  insert into public.profile_roles (profile_id, role_id) values (loren, director);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', loren, 'role', 'authenticated')::text, true);

  insert into public.portfolio_players (name, position, category_id)
    values ('Prueba Cartera', 'MC', 'cantera') returning id into pid;

  -- Firma a nombre de Mario: la base tiene que apuntar a Loren.
  update public.portfolio_players
    set deactivated_at = '2000-01-01', deactivated_by = mario, deactivation_reason = 'prueba'
    where id = pid;
  select deactivated_by into quien from public.portfolio_players where id = pid;
  res := res || 'baja_firmada_por_loren=' || (quien = loren) || '; ';
  select count(*) into n from public.portfolio_players where id = pid and deactivated_at > now() - interval '1 minute';
  res := res || 'fecha_la_pone_la_base=' || n || '; ';
  select count(*) into n from public.portfolio_changes where player_id = pid and action = 'deactivate' and actor_id = loren;
  res := res || 'baja_en_historial=' || n || '; ';

  -- Otro director (Mario, con Director prestado) intenta quedarse la baja de Loren.
  execute 'reset role';
  insert into public.profile_roles (profile_id, role_id) values (mario, director);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', mario, 'role', 'authenticated')::text, true);
  update public.portfolio_players set deactivated_at = '2020-01-01', deactivated_by = mario where id = pid;
  select count(*) into n from public.portfolio_players
    where id = pid and deactivated_by = loren and deactivated_at > now() - interval '1 minute';
  res := res || 'baja_no_se_reasigna=' || n || '; ';

  -- Loren, ya solo Agente, cambia el nombre de un jugador de baja reenviando la
  -- fecha en milisegundos, como hará el formulario: no le pide permiso.
  execute 'reset role';
  delete from public.profile_roles where profile_id = loren;
  insert into public.profile_roles (profile_id, role_id) values (loren, agente);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', loren, 'role', 'authenticated')::text, true);
  begin
    update public.portfolio_players
      set name = 'Prueba Cartera 2', deactivated_at = date_trunc('milliseconds', deactivated_at)
      where id = pid;
    res := res || 'agente_edita_jugador_de_baja=pasa; ';
  exception when others then res := res || 'agente_edita_jugador_de_baja=FALLA ' || sqlstate || '; ';
  end;
  select count(*) into n from public.portfolio_changes where player_id = pid and action = 'update';
  res := res || 'edicion_de_baja_en_historial=' || n || '; ';

  -- De vuelta a Director para recuperarlo.
  execute 'reset role';
  delete from public.profile_roles where profile_id = loren;
  insert into public.profile_roles (profile_id, role_id) values (loren, director);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', loren, 'role', 'authenticated')::text, true);

  update public.portfolio_players set deactivated_at = null where id = pid;
  select count(*) into n from public.portfolio_players
    where id = pid and deactivated_by is null and deactivation_reason is null;
  res := res || 'recuperado_limpio=' || n || '; ';
  select count(*) into n from public.portfolio_changes where player_id = pid and action = 'reactivate';
  res := res || 'recuperacion_en_historial=' || n || '; ';

  raise exception 'RESULTADOS (se deshace todo): %', res;
end $$;
```

Esperado: `baja_firmada_por_loren=true`, `fecha_la_pone_la_base=1`, `baja_en_historial=1`, `baja_no_se_reasigna=1`, `agente_edita_jugador_de_baja=pasa`, `edicion_de_baja_en_historial=1`, `recuperado_limpio=1`, `recuperacion_en_historial=1`.

- [ ] **Paso 3: Loren de creativo (sus roles reales), `anon`, y Mario con los dos departamentos**

```sql
do $$
declare
  loren uuid := '<LOREN>';
  mario uuid := '<MARIO>';
  director uuid := '<DIRECTOR>';
  res text := '';
  n bigint;
  claves text;
begin
  -- Loren tal cual: solo creativo.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', loren, 'role', 'authenticated')::text, true);
  select count(*) into n from public.portfolio_players; res := res || 'creativo_ve_tabla=' || n || '; ';
  select count(*) into n from public.portfolio_changes; res := res || 'creativo_ve_historial=' || n || '; ';
  create temp table _nombres on commit drop as select * from public.portfolio_names();
  select count(*) into n from _nombres; res := res || 'creativo_nombres=' || n || '; ';
  select count(*) into n from _nombres where team is null; res := res || 'sin_equipo=' || n || '; ';
  select string_agg(k, ',' order by k) into claves from (select jsonb_object_keys(to_jsonb(x)) k from (select * from _nombres limit 1) x) s;
  res := res || 'columnas=' || claves || '; ';

  -- Lo que devuelve la función, contra la tabla leída sin RLS.
  execute 'reset role';
  select count(*) into n from (
    select name, case when situation = 'loaned' then loaned_to else owner_club end as team
    from public.portfolio_players where deactivated_at is null
    except
    select name, team from _nombres
  ) d;
  res := res || 'diferencias_con_la_tabla=' || n || '; ';
  select count(*) into n from public.portfolio_players
    where deactivated_at is null and owner_club is null and situation is distinct from 'loaned';
  res := res || 'sin_equipo_esperado=' || n || '; ';

  -- Sin sesión.
  execute 'set local role anon';
  begin
    select count(*) into n from public.portfolio_players; res := res || 'anon_tabla=PASA(mal ' || n || '); ';
  exception when others then res := res || 'anon_tabla=falla ' || sqlstate || '; ';
  end;
  begin
    select count(*) into n from public.portfolio_names(); res := res || 'anon_nombres=PASA(mal ' || n || '); ';
  exception when others then res := res || 'anon_nombres=falla ' || sqlstate || '; ';
  end;

  -- Mario con su rol de creativo y un Director prestado.
  execute 'reset role';
  insert into public.profile_roles (profile_id, role_id) values (mario, director);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', mario, 'role', 'authenticated')::text, true);
  select count(*) into n from public.portfolio_players; res := res || 'dos_dptos_tabla=' || n || '; ';
  select count(*) into n from public.portfolio_names(); res := res || 'dos_dptos_nombres=' || n || '; ';

  raise exception 'RESULTADOS (se deshace todo): %', res;
end $$;
```

Esperado: `creativo_ve_tabla=0`, `creativo_ve_historial=0`, `creativo_nombres=165`, `sin_equipo` igual a `sin_equipo_esperado` (9 con el JSON del 2026-10-10), `columnas=name,team`, `diferencias_con_la_tabla=0`, `anon_tabla=falla 42501`, `anon_nombres=falla 42501`, `dos_dptos_tabla=165`, `dos_dptos_nombres=165`.

Cualquier otro resultado en los pasos 1 a 3: **parar** y contárselo a Mario antes de seguir.

- [ ] **Paso 4: nada se quedó escrito**

```sql
select (select count(*) from public.portfolio_players) as jugadores,
       (select count(*) from public.portfolio_players where name like 'Prueba %') as de_prueba,
       (select count(*) from public.portfolio_changes) as historial,
       (select string_agg(r.name, ', ') from public.profile_roles pr join public.roles r on r.id = pr.role_id
          where pr.profile_id = '<LOREN>') as roles_loren,
       (select string_agg(r.name, ', ') from public.profile_roles pr join public.roles r on r.id = pr.role_id
          where pr.profile_id = '<MARIO>') as roles_mario;
```

Esperado: 165 · 0 · 165 · `Diseñador` · `Gestor creativo`.

---

### Tarea 6: Documentación

**Archivos:**
- Modificar: `docs/estado-y-traspaso.md`, `docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md`, `.claude/rules/permisos.md`, `.claude/rules/migraciones.md`

Cargar antes la skill `docdocs` (verbo `cerrar`) y seguir sus formatos.

- [ ] **Paso 1: `estado-y-traspaso.md`**

- Cabecera «Actualizado»: entrada del día al principio (la cartera en la base, 051 aplicada, 165 jugadores cargados).
- «Qué se hizo en octubre de 2026»: apartado `### 2. La cartera en la base (fase 2 del campograma)` con qué hay (tres tablas, guardia de la baja, historial por trigger, `portfolio_names()`), por qué la carga no está en el repo (público, menores), cómo se cargó y cómo se comprobó (cifras y huella), los resultados de las sesiones simuladas, y los avisos de seguridad antes y después.
- «Qué queda pendiente», el 13: la fase 2 hecha; siguiente, la fase 3 (el campograma, solo consulta). Añadir que el JSON de `campograma-ph` deja de ser la fuente: desde la carga, un cambio en el campograma suelto **no llega** a la app, y conviven hasta la retirada (spec §8).

- [ ] **Paso 2: spec**

La línea «**Estado:**» pasa a decir que las fases 1 y 2 están hechas, con fecha.

- [ ] **Paso 3: reglas**

En `.claude/rules/permisos.md`, al final del párrafo de Agentes: ver, dar de alta y editar la cartera es de todo el departamento (`in_department`); dar de baja y recuperar es `dar_de_baja_jugadores`, de Director, y lo guarda un trigger porque la RLS no distingue columnas.

Una trampa nueva: **este repositorio es público**; ningún dato de un jugador —y menos de un menor— entra en un archivo versionado. Los datos se cargan aparte, desde fuera del repo (ejemplo: la carga de la cartera, tarea 4 de este plan). Al hacerlo se vio que vale para todo el repo, no solo para `supabase/`, así que va en `CLAUDE.md` («Trampas que valen para todo el repo»), y `.claude/rules/migraciones.md` remite a ella.

- [ ] **Paso 4: commit (solo con permiso de Mario)**

```bash
git add docs/estado-y-traspaso.md docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md .claude/rules/permisos.md .claude/rules/migraciones.md CLAUDE.md docs/superpowers/plans/2026-10-12-campograma-fase-2-cartera.md
git commit -m "docs(cartera): la cartera está en la base, con sus 165 jugadores y su historial"
```

---

### Tarea 7: Verificación de la rama e integración en `preview` (con permiso de Mario)

**Archivos:** ninguno nuevo.

- [ ] **Paso 1: automático**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Esperado: todo en verde, 218 tests.

- [ ] **Paso 2: nada de la cartera en el repo**

```bash
git diff preview --stat
node -e '
const d = require(process.env.HOME + "/Developer/campograma-ph/data/jugadores.json");
for (const p of d.jugadores) console.log(p.nombre);
for (const c of d.categorias) if (c.tecnico) console.log(c.tecnico.split(" — ")[0]);
' > "$SCRATCH/nombres-cartera.txt"
git diff preview | grep -F -c -f "$SCRATCH/nombres-cartera.txt" || true
```

Esperado: solo los archivos del mapa, y `0` coincidencias con nombres de la cartera. Si sale alguna, **parar** y sacarla antes de cualquier commit.

- [ ] **Paso 3: integrar (solo con permiso de Mario)**

Sin pantallas nuevas, integrar no cambia nada visible en staging. Desde la carpeta principal, comprobando antes la rama y que el árbol está limpio:

```bash
cd /Users/rodz/Developer/phsport-app
git branch --show-current
git status --short
git merge --no-ff feat/cartera
npx tsc --noEmit && npm run lint && npm test && npm run build
git push origin preview
```
