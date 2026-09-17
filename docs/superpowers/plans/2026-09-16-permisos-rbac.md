# Permisos por roles (RBAC) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** sustituir la casilla `profiles.role` (`ADMIN`/`DESIGNER`) por roles con permisos, de forma que la base de datos y el servidor pregunten lo mismo —«¿tiene esta cuenta este permiso?»— y un futbolista pueda entrar sin ser ni lo uno ni lo otro.

**Arquitectura:** tres tablas nuevas (`roles`, `role_permissions`, `profile_roles`) y una casilla dura `profiles.kind` (`AGENCIA`/`JUGADOR`). **Los roles son fijos** (decisión de Mario, 2026-09-16): los tres los siembra la migración y cambiarlos es otra migración; la app solo asigna un rol a cada persona. Tres funciones SQL (`has_permission`, `in_department`, `is_staff`) que usan las políticas RLS; el código deriva lo mismo de una consulta anidada del perfil con una función pura (`deriveAccess`). Se hace en tres migraciones: **044 añade** sin quitar nada, **045 cierra** las políticas, **046 borra** lo antiguo — y la 046 solo se aplica cuando `main` ya lleva el código nuevo, porque producción y preview comparten base.

**Stack:** Next.js 15 (App Router), Supabase (Postgres 17, RLS, RPC), SWR, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-roles-departamentos-y-jugadores-design.md`, §4 (permisos), §2 (departamentos) y «Lo que hay que arreglar antes».

## Restricciones globales

- **Castellano** en interfaz, comentarios y mensajes de commit; **identificadores en inglés**.
- **La base de datos es la de producción.** Cada migración se aplica con el visto bueno explícito de Mario. Se escribe el archivo `supabase/migrations/0NN_nombre.sql` **y** se aplica por MCP (`apply_migration`) con el nombre **sin el prefijo numérico** (`roles_y_permisos`, no `044_roles_y_permisos`): así están registradas la 042 (`fix_validate_invitation_search_path`) y la 043 en `supabase_migrations.schema_migrations`, donde la versión es un sello de tiempo.
- **Producción (`main`) y preview comparten base.** Nada de lo que se aplique a la base puede romper el código que hoy corre en `main`. Por eso la 044 y la 045 conviven con `profiles.role`, y la 046 espera al merge.
- Funciones SQL nuevas o reescritas: `SET search_path = ''` y todas las tablas cualificadas con `public.` (estilo de la 042/043). Nunca `'public, pg_temp'` entre comillas.
- Los permisos viven **solo** en `lib/utils/access.ts`. Los roles y qué permisos tiene cada uno se fijan **por migración**: no hay pantalla ni API que los edite. La app solo asigna roles a personas.
- **No se hace commit ni push sin que Mario lo pida.** Cada tarea acaba en un punto de control (tipos, lint, tests) y una propuesta de mensaje de commit; el commit lo autoriza él.
- Después de cada fase: `npx tsc --noEmit && npm run lint && npm test`. Build (`npm run build`) al cerrar la fase 2 y la fase 3.
- Nunca `git add -A`; comprobar `git branch --show-current` (debe ser `preview`) antes de cada commit.
- YAGNI: cuatro permisos, tres roles, un departamento. Ni uno más en este plan.

---

## Mapa de archivos

**Nuevos**
- `lib/utils/access.ts` — permisos, departamentos, tipos y funciones puras (`normalizeProfile`, `deriveAccess`, `viewModeFor`, `homeFor`).
- `lib/utils/access.test.ts` — sus tests.
- `lib/api/access.ts` — `loadAccess(supabase, userId)` para las rutas de API.
- `lib/hooks/use-roles.ts` — catálogo de roles (SWR).
- `lib/services/profiles/assignable.ts` — «quién entra en el reparto», una sola consulta para los seis sitios que hoy filtran por `role = 'DESIGNER'` (nace en la tarea 3, la usan la 3 y la 5).
- `supabase/migrations/044_roles_y_permisos.sql`, `045_politicas_por_permiso.sql`, `046_adios_role_enum.sql`.

**Modificados** (por tarea, ver abajo): `lib/auth/auth-context.tsx`, `lib/auth/get-server-auth.ts`, `lib/auth/view-as-context.tsx`, `lib/supabase/middleware.ts`, `lib/hooks/use-designers.ts`, `lib/hooks/use-users-data.ts`, `lib/hooks/use-team-data.ts`, `lib/hooks/use-upcoming-work.ts`, `lib/help/tips.ts`, `lib/help/select.ts`, `lib/help/select.test.ts`, `lib/services/designs/assignment.ts`, `app/api/designs/assign/route.ts`, `app/api/designs/bulk/route.ts`, `app/api/designs/chat/route.ts`, `app/api/designs/[id]/assignee/route.ts`, `app/api/users/[id]/route.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/invite/[token]/page.tsx`, `app/(dashboard)/inicio/page.tsx`, `app/(dashboard)/inicio/loading.tsx`, `app/(dashboard)/equipo/page.tsx`, `app/(dashboard)/equipo/[id]/page.tsx`, `app/(dashboard)/mi-semana/page.tsx`, `app/(dashboard)/ajustes/page.tsx`, `components/layout/app-sidebar.tsx`, `components/layout/user-menu.tsx`, `components/layout/view-as-menu-section.tsx`, `components/features/account/account-tab.tsx`, `components/features/account/members-panel.tsx`, `components/features/help/help-content.tsx`, `components/invitations/create-invitation-dialog.tsx`, `supabase/functions/admin-delete-user/index.ts`, `docs/estado-y-traspaso.md`, `CLAUDE.md`, el spec.

**Borrado:** `lib/utils/role.ts` (lo sustituye `access.ts`).

---

## Fase 0 — Lógica pura

### Tarea 1: `lib/utils/access.ts` y sus tests

**Archivos:**
- Crear: `lib/utils/access.ts`
- Crear: `lib/utils/access.test.ts`

**Interfaces:**
- Produce: `PERMISSIONS`, `Permission`, `DEPARTMENTS`, `Department`, `AccountKind`, `ProfileRole`, `ProfileWithRoles`, `Access`, `ViewMode`, `PROFILE_WITH_ROLES_SELECT`, `normalizeProfile(raw)`, `deriveAccess(profile)`, `viewModeFor(profile)`, `homeFor(mode)`, `VIEW_MODE_ACCENT`, `roleBadgeLabel(profile)`. Todo lo demás del plan consume esto.

- [x] **Paso 1: escribir los tests (fallan porque el módulo no existe)**

```ts
// lib/utils/access.test.ts
import { describe, it, expect } from 'vitest';
import {
  deriveAccess,
  homeFor,
  normalizeProfile,
  toProfile,
  viewModeFor,
  type ProfileWithRoles,
} from './access';

const base = {
  id: 'u1',
  given_name: 'Mario',
  family_name: null,
  alias: null,
  full_name: 'Mario',
  display_name: 'Mario',
  kind: 'AGENCIA' as const,
};

const gestor = {
  id: 'r1',
  name: 'Gestor creativo',
  department: 'creativo' as const,
  permissions: ['invitar_personal', 'invitar_jugadores', 'gestionar_roles'] as const,
};
const disenador = {
  id: 'r3',
  name: 'Diseñador',
  department: 'creativo' as const,
  permissions: ['recibir_asignaciones'] as const,
};

describe('normalizeProfile', () => {
  it('aplana la forma anidada que devuelve PostgREST', () => {
    const raw = {
      ...base,
      profile_roles: [
        {
          role: {
            id: 'r3',
            name: 'Diseñador',
            department: 'creativo',
            role_permissions: [{ permission: 'recibir_asignaciones' }],
          },
        },
      ],
    };
    const p = normalizeProfile(raw);
    expect(p.roles).toEqual([disenador]);
    expect('profile_roles' in p).toBe(false);
  });

  it('sin filas anidadas deja roles vacío', () => {
    expect(normalizeProfile({ ...base }).roles).toEqual([]);
    expect(normalizeProfile({ ...base, profile_roles: null }).roles).toEqual([]);
  });

  it('toProfile convierte una fila cualquiera en perfil con roles', () => {
    const p = toProfile({ ...base, profile_roles: null });
    expect(p.kind).toBe('AGENCIA');
    expect(p.roles).toEqual([]);
  });

  it('ignora permisos que el código no conoce', () => {
    const raw = {
      ...base,
      profile_roles: [
        {
          role: {
            id: 'r9',
            name: 'Raro',
            department: 'creativo',
            role_permissions: [{ permission: 'volar' }, { permission: 'gestionar_roles' }],
          },
        },
      ],
    };
    expect(normalizeProfile(raw).roles[0].permissions).toEqual(['gestionar_roles']);
  });
});

describe('deriveAccess', () => {
  it('une los permisos de todos los roles', () => {
    const a = deriveAccess({ ...base, roles: [gestor, disenador] });
    expect(a.can('gestionar_roles')).toBe(true);
    expect(a.can('recibir_asignaciones')).toBe(true);
    expect(a.inDepartment('creativo')).toBe(true);
    expect(a.roleNames).toEqual(['Gestor creativo', 'Diseñador']);
  });

  it('un futbolista no tiene permisos aunque tenga roles', () => {
    const a = deriveAccess({ ...base, kind: 'JUGADOR', roles: [gestor] });
    expect(a.can('gestionar_roles')).toBe(false);
    expect(a.inDepartment('creativo')).toBe(false);
    expect(a.kind).toBe('JUGADOR');
  });

  it('sin perfil no hay nada', () => {
    const a = deriveAccess(null);
    expect(a.can('invitar_personal')).toBe(false);
    expect(a.kind).toBeNull();
    expect(a.roleNames).toEqual([]);
  });
});

describe('viewModeFor / homeFor', () => {
  const withRoles = (roles: ProfileWithRoles['roles']): ProfileWithRoles => ({ ...base, roles });

  it('quien recibe asignaciones ve la cara de diseñador', () => {
    expect(viewModeFor(withRoles([disenador]))).toBe('designer');
    expect(homeFor('designer')).toBe('/mi-semana');
  });

  it('quien no las recibe ve la cara de gestión', () => {
    expect(viewModeFor(withRoles([gestor]))).toBe('manager');
    expect(homeFor('manager')).toBe('/inicio');
  });

  it('un senior recibe trabajo, así que ve la cara de diseñador', () => {
    const senior = { ...gestor, id: 'r2', name: 'Diseñador senior', permissions: ['invitar_personal', 'recibir_asignaciones'] as const };
    expect(viewModeFor(withRoles([senior]))).toBe('designer');
  });

  it('un futbolista va a su área', () => {
    expect(viewModeFor({ ...base, kind: 'JUGADOR', roles: [] })).toBe('player');
    expect(homeFor('player')).toBe('/area-personal');
  });

  it('sin perfil, la cara de menos privilegio (como hasta ahora)', () => {
    expect(viewModeFor(null)).toBe('designer');
  });
});
```

- [x] **Paso 2: ejecutar y ver que falla**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: FAIL, «Cannot find module './access'».

- [x] **Paso 3: escribir el módulo**

```ts
// lib/utils/access.ts
/**
 * Permisos por roles — la única fuente de verdad de QUÉ permisos existen.
 *
 * La base guarda roles y qué permisos tiene cada uno (fijados por migración:
 * no hay pantalla que los edite); el código decide qué permisos existen y qué
 * significa cada uno. Añadir un permiso es añadirlo a PERMISSIONS y darlo al
 * rol que toque en una migración de una fila.
 *
 * Todo lo de aquí es puro: lo usan el navegador, el servidor y el middleware.
 */

export const PERMISSIONS = [
  'invitar_personal',
  'invitar_jugadores',
  'gestionar_roles',
  'recibir_asignaciones',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEPARTMENTS = ['creativo'] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Barrera dura: un futbolista no tiene roles, tenga lo que tenga en la tabla. */
export type AccountKind = 'AGENCIA' | 'JUGADOR';

export interface ProfileRole {
  id: string;
  name: string;
  department: Department;
  permissions: readonly Permission[];
}

/** Lo mínimo que hace falta de un perfil para decidir acceso. */
export interface ProfileWithRoles {
  id: string;
  given_name: string;
  family_name?: string | null;
  alias?: string | null;
  full_name: string;
  display_name: string;
  kind: AccountKind;
  roles: ProfileRole[];
  avatar_url?: string | null;
  is_dev?: boolean;
  accent_color?: string | null;
}

/**
 * Selección para traer un perfil CON sus roles en una sola petición.
 * `profile_roles` tiene dos claves hacia `profiles` (quién lo tiene y quién lo
 * dio), así que hay que decirle a PostgREST cuál seguir.
 */
export const PROFILE_ROLES_EMBED =
  'profile_roles!profile_roles_profile_id_fkey(role:roles(id, name, department, role_permissions(permission)))';
export const PROFILE_WITH_ROLES_SELECT = `*, ${PROFILE_ROLES_EMBED}`;

export interface RawRole {
  id: string;
  name: string;
  department: string;
  role_permissions?: { permission: string }[] | null;
}
/** Forma anidada que devuelve PostgREST con PROFILE_ROLES_EMBED. */
export interface RawProfileRoles {
  profile_roles?: { role: RawRole | null }[] | null;
}

function isPermission(x: string): x is Permission {
  return (PERMISSIONS as readonly string[]).includes(x);
}
function isDepartment(x: string): x is Department {
  return (DEPARTMENTS as readonly string[]).includes(x);
}

/**
 * Convierte la forma anidada de PostgREST en `roles: ProfileRole[]`.
 * Permisos o departamentos que el código no conoce se descartan en silencio:
 * un permiso que no existe en PERMISSIONS no puede dar acceso a nada.
 */
export function normalizeProfile<T extends RawProfileRoles>(raw: T): Omit<T, 'profile_roles'> & { roles: ProfileRole[] } {
  const { profile_roles, ...rest } = raw;
  const roles: ProfileRole[] = [];
  for (const row of profile_roles ?? []) {
    const r = row?.role;
    if (!r || !isDepartment(r.department)) continue;
    roles.push({
      id: r.id,
      name: r.name,
      department: r.department,
      permissions: (r.role_permissions ?? []).map((p) => p.permission).filter(isPermission),
    });
  }
  return { ...rest, roles };
}

/**
 * Una fila de `profiles` con el embed, tal como llega de supabase-js (tipada
 * como `any` por el `*`), convertida en perfil. El único cast vive aquí.
 */
export function toProfile(raw: unknown): ProfileWithRoles {
  return normalizeProfile(raw as RawProfileRoles & Omit<ProfileWithRoles, 'roles'>) as ProfileWithRoles;
}

export interface Access {
  kind: AccountKind | null;
  permissions: ReadonlySet<Permission>;
  departments: ReadonlySet<Department>;
  roleNames: string[];
  can: (permission: Permission) => boolean;
  inDepartment: (department: Department) => boolean;
}

const NO_ACCESS: Access = {
  kind: null,
  permissions: new Set(),
  departments: new Set(),
  roleNames: [],
  can: () => false,
  inDepartment: () => false,
};

/** Une los permisos de todos los roles. Un JUGADOR no obtiene nada. */
export function deriveAccess(profile: Pick<ProfileWithRoles, 'kind' | 'roles'> | null | undefined): Access {
  if (!profile) return NO_ACCESS;
  if (profile.kind !== 'AGENCIA') {
    return { ...NO_ACCESS, kind: profile.kind, roleNames: profile.roles.map((r) => r.name) };
  }
  const permissions = new Set<Permission>();
  const departments = new Set<Department>();
  for (const role of profile.roles) {
    departments.add(role.department);
    for (const p of role.permissions) permissions.add(p);
  }
  return {
    kind: profile.kind,
    permissions,
    departments,
    roleNames: profile.roles.map((r) => r.name),
    can: (p) => permissions.has(p),
    inDepartment: (d) => departments.has(d),
  };
}

/**
 * Qué cara de la app ve cada cuenta. Sustituye a `role === 'ADMIN'`:
 * quien recibe asignaciones ve su semana y su panel; quien no, el del equipo.
 * Sin perfil resuelto, la cara de menos privilegio (igual que antes).
 */
export type ViewMode = 'manager' | 'designer' | 'player';

export function viewModeFor(profile: Pick<ProfileWithRoles, 'kind' | 'roles'> | null | undefined): ViewMode {
  if (!profile) return 'designer';
  if (profile.kind === 'JUGADOR') return 'player';
  return deriveAccess(profile).can('recibir_asignaciones') ? 'designer' : 'manager';
}

/** Página de entrada tras iniciar sesión. */
export function homeFor(mode: ViewMode): string {
  switch (mode) {
    case 'player':
      return '/area-personal';
    case 'designer':
      return '/mi-semana';
    default:
      return '/inicio';
  }
}

/** Clases de color por cara — literales completos para que Tailwind las detecte. */
export const VIEW_MODE_ACCENT: Record<ViewMode, string> = {
  manager: 'bg-primary/15 text-primary',
  designer: 'bg-role-designer/15 text-role-designer',
  player: 'bg-muted text-muted-foreground',
};

/** Texto del distintivo bajo el nombre: los roles, o un guion si no hay. */
export function roleBadgeLabel(profile: Pick<ProfileWithRoles, 'roles'> | null | undefined): string {
  const names = profile?.roles.map((r) => r.name) ?? [];
  return names.length ? names.join(' · ') : '—';
}
```

- [x] **Paso 4: ejecutar los tests**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: PASS, 13 tests.

- [x] **Paso 5: punto de control**

Run: `npx tsc --noEmit && npm run lint`
Esperado: sin errores (el módulo aún no lo importa nadie).

Commit propuesto (con el OK de Mario): `feat(permisos): nace la lógica pura de roles y permisos`

---

## Fase 1 — La base añade, no quita

### Tarea 2: migración 044

**Archivos:**
- Crear: `supabase/migrations/044_roles_y_permisos.sql`

**Interfaces:**
- Produce en la base: tipo `account_kind`; columna `profiles.kind`; tablas `roles`, `role_permissions`, `profile_roles`; funciones `has_permission(uid, perm)`, `in_department(uid, dept)`, `is_staff(uid)`, `profiles_with_permission(perm)`, `set_profile_roles(p_profile_id, p_role_ids)`; `use_invitation` v2 y `get_invitation_by_token` v2; columnas `invitations.role_id` y `invitations.created_by`.
- **No toca** ninguna política existente ni `profiles.role`: el código de hoy sigue funcionando igual.

- [x] **Paso 1: escribir el archivo**

```sql
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
```

- [x] **Paso 2: comprobar el estado vivo antes de aplicar**

Con `execute_sql` (solo lectura), confirmar que nada de lo que crea la 044 existe ya:

```sql
select
  to_regclass('public.roles') as roles,
  to_regclass('public.profile_roles') as profile_roles,
  exists (select 1 from pg_type where typname = 'account_kind') as account_kind,
  exists (select 1 from pg_proc where proname = 'has_permission') as has_permission;
```
Esperado: `null, null, false, false`.

- [x] **Paso 3: pedir el visto bueno a Mario y aplicar**

`apply_migration` con `name: "roles_y_permisos"` y el contenido del archivo. **No aplicar sin su OK explícito en el turno.**

- [x] **Paso 4: verificar (lectura)**

```sql
-- 8 personas, cada una con exactamente un rol
select p.display_name, p.role, r.name
from public.profiles p
join public.profile_roles pr on pr.profile_id = p.id
join public.roles r on r.id = pr.role_id
order by p.display_name;
```
Esperado: 8 filas; los 4 `ADMIN` con «Gestor creativo», los 4 `DESIGNER` con «Diseñador».

```sql
select
  public.has_permission((select id from public.profiles where display_name = 'Mario'), 'gestionar_roles') as mario_gestiona,
  public.has_permission((select id from public.profiles where display_name = 'Loren'), 'gestionar_roles') as loren_gestiona,
  public.has_permission((select id from public.profiles where display_name = 'Loren'), 'invitar_jugadores') as loren_invita_jugadores,
  public.in_department((select id from public.profiles where display_name = 'Loren'), 'creativo') as loren_creativo,
  public.is_staff(gen_random_uuid()) as desconocido_staff;
```
Esperado: `true, false, true, true, false`.

```sql
-- La guardia funciona: intentar dejar a la agencia sin gestor y deshacer.
begin;
delete from public.profile_roles
where role_id = (select id from public.roles where name = 'Gestor creativo');
commit;
```
Esperado: error `Debe quedar al menos una persona con el permiso gestionar_roles`, y ninguna fila borrada (comprobar de nuevo la consulta de las 8 personas).

```sql
-- La política y el registro de la 044
select count(*) from public.audit_log where entity = 'profile_roles' and action = 'GRANT';
```
Esperado: 8.

- [ ] **Paso 5: comprobar que el código de hoy sigue vivo** (aplicada el 2026-09-16 como `roles_y_permisos`; pasos 1-4 verificados; este lo hace Mario)

Abrir preview con la cuenta de Mario: `/inicio` carga, `/ajustes?tab=miembros` lista a los ocho, y el diálogo de invitación crea un enlace (no hace falta usarlo). Nada ha cambiado para el usuario; eso es lo esperado.

Commit propuesto: `feat(permisos): la base conoce roles y permisos, sin quitar el rol antiguo`

---

## Fase 2 — El código deja de leer `role`

Al terminar esta fase, `grep -rn "\.role\b\|'ADMIN'\|'DESIGNER'" app lib components` no devuelve nada fuera del chat (`role: 'user' | 'assistant'`). `tsc` lo garantiza: `Profile.role` desaparece del tipo en la tarea 3.

### Tarea 3: la sesión lleva los permisos

**Archivos:**
- Modificar: `lib/auth/auth-context.tsx:15-56`, `:108-160`
- Modificar: `lib/auth/get-server-auth.ts:35-43`
- Modificar: `lib/auth/view-as-context.tsx` (entero)
- Modificar: `lib/hooks/use-designers.ts` (entero)
- Modificar: `components/layout/view-as-menu-section.tsx:74`
- Crear: `lib/api/access.ts`
- Crear: `lib/hooks/use-roles.ts`
- Crear: `lib/services/profiles/assignable.ts`

**Interfaces:**
- Consume: `toProfile`, `normalizeProfile`, `deriveAccess`, `PROFILE_WITH_ROLES_SELECT`, `PROFILE_ROLES_EMBED`, `RawProfileRoles`, `ProfileWithRoles`, `Access` (tarea 1).
- Produce: `Profile` (= `ProfileWithRoles`), `useAuth().access: Access`, `useViewAs().realViewMode`, `useViewAs().enterDesignerView(designer: Designer)`, `Designer.roles`, `useRoles()`, `loadAccess(supabase, userId)`, `assignableProfiles<T>(supabase, columns)`.

**Sobre los tipos (verificado con el compilador antes de escribir el plan):** sin tipos generados, `select('*, …')` devuelve `any` y `normalizeProfile(any)` no lleva `kind`; por eso el perfil se convierte siempre con `toProfile`. Y `rpc(...).select(columns)` con `columns: string` devuelve un tipo inútil (`GenericStringError`): el helper fija la fila con `.overrideTypes<T[], { merge: false }>()`.

- [x] **Paso 1: `Profile` pasa a ser el perfil con roles**

En `lib/auth/auth-context.tsx`, sustituir la interfaz `Profile` (líneas 15-29) por:

```ts
import { deriveAccess, toProfile, PROFILE_WITH_ROLES_SELECT, type Access, type ProfileWithRoles } from '@/lib/utils/access';

/** Perfil con sus roles ya aplanados (ver lib/utils/access.ts). */
export type Profile = ProfileWithRoles;
```

En `AuthState` añadir `access: Access;`. En el valor por defecto del contexto añadir `access: deriveAccess(null),`.

Sustituir la consulta del perfil (líneas 109-113) por:

```ts
      const { data: rawProfile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_ROLES_SELECT)
        .eq('id', user.id)
        .maybeSingle();
```

Tras el `if (!profile)` (que ahora comprueba `rawProfile`), añadir `const profile = toProfile(rawProfile);` y en la comparación de cambios (líneas 138-145) sustituir `prev.profile?.role === profile.role` por:

```ts
          prev.profile?.kind === profile.kind &&
          JSON.stringify(prev.profile?.roles) === JSON.stringify(profile.roles) &&
```

En el `return` que actualiza el estado, añadir `access: deriveAccess(profile),`. Donde el estado pasa a `UNAUTHENTICATED` hay **cinco** sitios (líneas 104 sin sesión, 127 sin perfil, 165 `catch`, 188 `SIGNED_OUT`, 241 `catch` del logout): en todos, `access: deriveAccess(null)` — si se olvida el de `SIGNED_OUT`, `access.can(...)` sigue diciendo que sí después de cerrar sesión hasta recargar. Mejor un `const signedOut = (prev: AuthState): AuthState => ({ ...prev, status: 'UNAUTHENTICATED', user: null, profile: null, access: deriveAccess(null) })` y usarlo en los cinco. Buscar también dónde se construye el estado inicial desde `initialProfile` (línea ~83) y derivar ahí: `access: deriveAccess(initialProfile ?? null)`.

- [x] **Paso 2: el servidor hace la misma consulta**

En `lib/auth/get-server-auth.ts`, líneas 35-43:

```ts
    const { data: raw, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_WITH_ROLES_SELECT)
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !raw) return { user, profile: null };

    return { user, profile: toProfile(raw) };
```

con `import { toProfile, PROFILE_WITH_ROLES_SELECT } from '@/lib/utils/access';`.

- [x] **Paso 3: helper de acceso para las rutas de API**

```ts
// lib/api/access.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveAccess, toProfile, PROFILE_WITH_ROLES_SELECT, type Access } from '@/lib/utils/access';

/**
 * Permisos del usuario que llama, leídos bajo su propia RLS. Una cuenta sin
 * roles obtiene un Access vacío, que es exactamente lo que le corresponde.
 */
export async function loadAccess(supabase: SupabaseClient, userId: string): Promise<Access> {
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_WITH_ROLES_SELECT)
    .eq('id', userId)
    .maybeSingle();
  return deriveAccess(data ? toProfile(data) : null);
}
```

- [x] **Paso 4: una sola consulta para «quién entra en el reparto», y la lista trae sus roles**

```ts
// lib/services/profiles/assignable.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Perfiles con el permiso `recibir_asignaciones`, bajo la RLS del llamante.
 * Sustituye a los `.eq('role', 'DESIGNER')` que había repartidos por seis
 * sitios: si mañana cambia qué significa «entrar en el reparto», cambia aquí.
 *
 * `columns` es un string cualquiera, así que supabase-js no puede inferir la
 * fila: se fija con `T` (por defecto, solo `id`).
 */
export function assignableProfiles<T = { id: string }>(supabase: SupabaseClient, columns: string = 'id') {
  return supabase
    .rpc('profiles_with_permission', { perm: 'recibir_asignaciones' })
    .select(columns)
    .overrideTypes<T[], { merge: false }>();
}
```

`lib/hooks/use-designers.ts` completo:

```ts
'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { normalizeProfile, PROFILE_ROLES_EMBED, type ProfileRole, type RawProfileRoles } from '@/lib/utils/access';

type DesignerRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
} & RawProfileRoles;

export interface Designer {
  id: string;
  /** Nombre completo (Nombre + Primer apellido). Gestión / compat. */
  name: string;
  /** Nombre corto para el día a día (alias || given_name). */
  displayName: string;
  avatar_url?: string;
  /** Sus roles: «Ver como» los copia para simular su cara de la app. */
  roles: ProfileRole[];
}

async function fetchDesigners(): Promise<Designer[]> {
  const supabase = createClient();
  // Quien tiene el permiso de recibir asignaciones, bajo la RLS del llamante.
  const { data, error } = await assignableProfiles<DesignerRow>(
    supabase,
    `id, full_name, display_name, avatar_url, ${PROFILE_ROLES_EMBED}`
  );

  if (error) throw error;

  return (data || []).map((raw) => {
    const p = normalizeProfile(raw);
    return {
      id: p.id,
      name: p.full_name || 'Sin nombre',
      displayName: p.display_name || p.full_name || 'Sin nombre',
      avatar_url: p.avatar_url ?? undefined,
      roles: p.roles,
    };
  });
}

/**
 * Lista de quien recibe diseños. Key SWR compartida ('designers') → una sola
 * query por sesión aunque el hook se monte varias veces en la misma página.
 */
export function useDesigners() {
  const { data, error, isLoading } = useSWR<Designer[]>('designers', fetchDesigners);

  return {
    designers: data ?? [],
    loading: isLoading,
    error: error ? 'Error al cargar diseñadores' : null,
  };
}
```

- [x] **Paso 5: catálogo de roles**

```ts
// lib/hooks/use-roles.ts
'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DEPARTMENTS, PERMISSIONS, type Department, type Permission } from '@/lib/utils/access';

export interface RoleWithPermissions {
  id: string;
  name: string;
  department: Department;
  permissions: Permission[];
}

async function fetchRoles(): Promise<RoleWithPermissions[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, department, role_permissions(permission)')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((r) => (DEPARTMENTS as readonly string[]).includes(r.department))
    .map((r) => ({
      id: r.id,
      name: r.name,
      department: r.department as Department,
      permissions: (r.role_permissions ?? [])
        .map((p: { permission: string }) => p.permission)
        .filter((p: string): p is Permission => (PERMISSIONS as readonly string[]).includes(p)),
    }));
}

/** Roles de la agencia. Solo se pide con sesión: la RLS exige ser personal. */
export function useRoles() {
  const { status } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<RoleWithPermissions[]>(
    status === 'AUTHENTICATED' ? 'roles' : null,
    fetchRoles
  );
  return { roles: data ?? [], isLoading, error: error ?? null, mutate };
}
```

- [x] **Paso 6: «Ver como» simula a una persona con sus roles**

`lib/auth/view-as-context.tsx` completo:

```tsx
'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AuthContext, useAuth, type Profile } from '@/lib/auth/auth-context';
import type { Designer } from '@/lib/hooks/use-designers';
import { deriveAccess, viewModeFor, type ProfileRole, type ViewMode } from '@/lib/utils/access';

const STORAGE_KEY = 'phsport:view-as';

interface ViewAsState {
  mode: 'real' | 'designer';
  designerId: string | null;
  designerName: string | null;
  /** Roles reales de la persona simulada: la simulación enseña SU cara, no una inventada. */
  designerRoles: ProfileRole[];
}

interface ViewAsContextValue {
  /** La cuenta real es dev (is_dev en Supabase) y es de la agencia. */
  isDev: boolean;
  /** Hay una simulación activa. */
  simulating: boolean;
  simulatedDesignerId: string | null;
  simulatedDesignerName: string | null;
  enterDesignerView: (designer: Designer) => void;
  exitToManager: () => void;
  /** Identidad REAL (para el menú de cuenta y la píldora). */
  realName: string | null;
  realDisplayName: string | null;
  realEmail: string | null;
  realProfile: Profile | null;
  realViewMode: ViewMode;
  realAvatarUrl: string | null;
}

const ViewAsContext = createContext<ViewAsContextValue>({
  isDev: false,
  simulating: false,
  simulatedDesignerId: null,
  simulatedDesignerName: null,
  enterDesignerView: () => {},
  exitToManager: () => {},
  realName: null,
  realDisplayName: null,
  realEmail: null,
  realProfile: null,
  realViewMode: 'designer',
  realAvatarUrl: null,
});

const REAL: ViewAsState = { mode: 'real', designerId: null, designerName: null, designerRoles: [] };

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  // useAuth() aquí resuelve al AuthProvider de la raíz => identidad REAL.
  const auth = useAuth();
  const realUser = auth.user;
  const realProfile = auth.profile;

  const isDev = realProfile?.is_dev === true && realProfile.kind === 'AGENCIA';

  const [state, setState] = useState<ViewAsState>(REAL);

  // Cargar estado persistido (solo cliente, tras montar para evitar mismatch SSR).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ViewAsState>;
      if (parsed && (parsed.mode === 'real' || parsed.mode === 'designer')) {
        setState({ ...REAL, ...parsed, designerRoles: parsed.designerRoles ?? [] });
      }
    } catch {
      // storage corrupto: ignorar
    }
  }, []);

  // Persistir cambios — solo para cuentas dev (no ensuciar el storage del resto).
  useEffect(() => {
    if (typeof window === 'undefined' || !isDev) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isDev]);

  const enterDesignerView = useCallback((designer: Designer) => {
    setState({
      mode: 'designer',
      designerId: designer.id,
      designerName: designer.displayName,
      designerRoles: designer.roles,
    });
  }, []);

  const exitToManager = useCallback(() => {
    setState(REAL);
  }, []);

  // Solo dev puede simular; en cualquier otro caso, identidad real.
  const simulating = isDev && state.mode === 'designer' && !!state.designerId;

  // Identidad EFECTIVA inyectada en el AuthContext para todos los consumidores.
  // Es un disfraz de solo frontend: servidor y RLS siguen viendo la cuenta real.
  const effectiveAuth = useMemo(() => {
    if (!simulating || !realUser) return auth;
    const profile: Profile = {
      id: state.designerId!,
      given_name: state.designerName ?? 'Diseñador',
      family_name: null,
      alias: null,
      full_name: state.designerName ?? 'Diseñador',
      display_name: state.designerName ?? 'Diseñador',
      kind: 'AGENCIA',
      roles: state.designerRoles,
      avatar_url: undefined,
    };
    return {
      ...auth,
      user: { ...realUser, id: state.designerId! },
      profile,
      access: deriveAccess(profile),
    };
  }, [auth, simulating, realUser, state.designerId, state.designerName, state.designerRoles]);

  const viewAsValue = useMemo<ViewAsContextValue>(
    () => ({
      isDev,
      simulating,
      simulatedDesignerId: simulating ? state.designerId : null,
      simulatedDesignerName: simulating ? state.designerName : null,
      enterDesignerView,
      exitToManager,
      realName: realProfile?.full_name ?? null,
      realDisplayName: realProfile?.display_name ?? null,
      realEmail: realUser?.email ?? null,
      realProfile,
      realViewMode: viewModeFor(realProfile),
      realAvatarUrl: realProfile?.avatar_url ?? null,
    }),
    [isDev, simulating, state.designerId, state.designerName, enterDesignerView, exitToManager, realProfile, realUser?.email]
  );

  return (
    <AuthContext.Provider value={effectiveAuth}>
      <ViewAsContext.Provider value={viewAsValue}>{children}</ViewAsContext.Provider>
    </AuthContext.Provider>
  );
}

export const useViewAs = () => useContext(ViewAsContext);
```

En `components/layout/view-as-menu-section.tsx:74`, `enterDesignerView(d.id, d.displayName)` → `enterDesignerView(d)`.

- [x] **Paso 7: punto de control**

Run: `npx tsc --noEmit`
Esperado: **falla** en todos los sitios que leen `profile.role` (son los de las tareas 4-7). Esa lista es la guía: las tareas 4 a 7 la vacían. `npm test` debe seguir en verde (165 + 11).

No hay commit hasta cerrar la tarea 4: el árbol no compila entre medias.

### Tarea 4: la app decide por cara y por permiso

**Archivos:**
- Modificar: `lib/supabase/middleware.ts:66-81`
- Modificar: `app/(auth)/login/page.tsx:43-56`
- Modificar: `components/layout/app-sidebar.tsx:145-166`; `components/layout/mobile-tab-bar.tsx:48`
- Modificar: `app/(dashboard)/inicio/page.tsx:158,180`; `app/(dashboard)/inicio/loading.tsx:12-13`
- Modificar: `app/(dashboard)/equipo/page.tsx:167,182`; `app/(dashboard)/equipo/[id]/page.tsx:56,72`; `app/(dashboard)/mi-semana/page.tsx:58`
- Modificar: `lib/hooks/use-upcoming-work.ts:31`; `lib/hooks/use-team-data.ts:27-30,68`; `lib/hooks/use-users-data.ts` (entero)
- Modificar: `components/layout/user-menu.tsx:20,28,123-131,144`
- Modificar: `app/(dashboard)/ajustes/page.tsx:54,56,77-84,89,98,132`; `components/features/account/account-tab.tsx:19,147-153`
- Modificar: `lib/help/tips.ts:16` y las tres entradas con `audience: 'ADMIN'` (líneas 147, 155, 163); `lib/help/select.ts:17-28`; `lib/help/select.test.ts:24-39`; `components/features/help/help-content.tsx:38`
- Borrar: `lib/utils/role.ts`

**Interfaces:**
- Consume: `useAuth().access`, `viewModeFor`, `homeFor`, `VIEW_MODE_ACCENT`, `roleBadgeLabel`, `useViewAs().realViewMode/realProfile`.

- [x] **Paso 1: casa tras iniciar sesión (middleware y login)**

`lib/supabase/middleware.ts`, líneas 66-81:

```ts
    if (isPublicRoute && !isAuthHandler) {
      // Con sesión, /login y /invite llevan a la casa que le toca a la cuenta.
      const { data: raw } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_ROLES_SELECT)
        .eq('id', user.id)
        .maybeSingle()

      const url = request.nextUrl.clone()
      url.pathname = homeFor(viewModeFor(raw ? toProfile(raw) : null))
      return NextResponse.redirect(url)
    }
```

con `import { homeFor, toProfile, PROFILE_WITH_ROLES_SELECT, viewModeFor } from '@/lib/utils/access'`.

`app/(auth)/login/page.tsx`, líneas 43-56: la consulta pasa a `.select(PROFILE_WITH_ROLES_SELECT)` y la última línea a
`window.location.href = homeFor(viewModeFor(toProfile(profile)));`.

- [x] **Paso 2: navegación**

`components/layout/app-sidebar.tsx:145-153`:

```ts
export function buildNavItems(mode: ViewMode): NavItem[] {
  return [
    { href: '/inicio', label: 'Inicio', icon: Home },
    // Vista semanal de trabajo: el equipo (gestión) o la cola propia (quien recibe diseños).
    mode === 'manager'
      ? { href: '/equipo', label: 'Semana', icon: CalendarRange }
      : { href: '/mi-semana', label: 'Semana', icon: CalendarRange },
    { href: '/disenos', label: 'Diseños', icon: Palette },
  ];
}
```

y en `AppSidebar` (línea 166) y `mobile-tab-bar.tsx:48`: `buildNavItems(viewModeFor(profile))`.

- [x] **Paso 3: inicio, equipo, mi semana**

Patrón único. Donde había `profile?.role === 'ADMIN'` pasa a `viewModeFor(profile) === 'manager'`:

- `inicio/page.tsx:158` y `:180`: `const mode = viewModeFor(profile);` arriba del `return`; skeleton `variant={mode === 'manager' ? 'admin' : 'designer'}`; rama `mode === 'manager' ? (<AdminDashboard …`.
- `inicio/loading.tsx:13`: `variant={viewModeFor(profile) === 'manager' ? 'admin' : 'designer'}`.
- `equipo/page.tsx:167` y `:182`, `equipo/[id]/page.tsx:56` y `:72`: `profile.role !== 'ADMIN'` → `viewModeFor(profile) !== 'manager'`. El destino del `router.replace` pasa a `homeFor(viewModeFor(profile))` (un futbolista que caiga aquí va a su área, no a `/mi-semana`).
- `mi-semana/page.tsx:58`: `profile.role === 'ADMIN'` → `viewModeFor(profile) === 'manager'`.
- `lib/hooks/use-upcoming-work.ts:31`: `const isDesigner = viewModeFor(profile) === 'designer';`.
- `lib/hooks/use-team-data.ts:68`: `const isManager = status === 'AUTHENTICATED' && viewModeFor(profile) === 'manager';` (y la key SWR usa `isManager`). La consulta de las líneas 27-30 se cambia en la tarea 5.

- [x] **Paso 4: lista de miembros**

`lib/hooks/use-users-data.ts` completo:

```ts
import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { normalizeProfile, PROFILE_ROLES_EMBED, type AccountKind, type ProfileRole, type RawProfileRoles } from '@/lib/utils/access';

export interface Member {
  id: string;
  given_name: string;
  family_name?: string | null;
  alias?: string | null;
  full_name: string;
  display_name: string;
  kind: AccountKind;
  roles: ProfileRole[];
  created_at: string;
  avatar_url?: string | null;
}

/** Fila tal como llega de PostgREST; sin tipos generados hay que fijarla a mano. */
type RawMember = Omit<Member, 'roles'> & RawProfileRoles;

interface UseUsersDataReturn {
  users: Member[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const fetchUsersData = async (): Promise<Member[]> => {
  const supabase = createClient();
  // Sin tipos generados, `from()` devuelve `any` y no admite `.overrideTypes<>()`
  // (TS2347): la fila se fija anotando el resultado.
  const { data, error }: { data: RawMember[] | null; error: PostgrestError | null } = await supabase
    .from('profiles')
    .select(`id, given_name, family_name, alias, full_name, display_name, kind, created_at, avatar_url, ${PROFILE_ROLES_EMBED}`)
    .eq('kind', 'AGENCIA')
    .eq('is_dev', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((raw) => normalizeProfile(raw) as Member);
};

/** Miembros de la agencia. Solo quien invita o gestiona roles lo pide. */
export function useUsersData(): UseUsersDataReturn {
  const { access, status } = useAuth();
  const allowed =
    status === 'AUTHENTICATED' && (access.can('invitar_personal') || access.can('gestionar_roles'));

  const { data, error, isLoading, mutate } = useSWR<Member[]>(allowed ? 'users-data' : null, fetchUsersData);

  return { users: data ?? [], isLoading, error: error ?? null, mutate };
}
```

(`Profile` de este archivo pasa a llamarse `Member`; `members-panel.tsx` se adapta en la tarea 7 — hasta entonces cambiar allí solo el import: `type Member as Profile`.)

- [x] **Paso 5: menú de usuario, Ajustes, cuenta**

`components/layout/user-menu.tsx`:
- línea 20: `import { VIEW_MODE_ACCENT, roleBadgeLabel } from '@/lib/utils/access';`
- línea 28: `const { isDev, realName, realDisplayName, realEmail, realProfile, realViewMode, realAvatarUrl } = useViewAs();`
- líneas 123-131: el distintivo pasa a
  ```tsx
  {realProfile && (
    <span className={cn('mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[11px] md:text-[10px] font-semibold uppercase tracking-wider', VIEW_MODE_ACCENT[realViewMode])}>
      {roleBadgeLabel(realProfile)}
    </span>
  )}
  ```
- línea 144: `{profile?.role === 'ADMIN' && (` → `{(access.can('invitar_personal') || access.can('gestionar_roles')) && (` (sacar `access` de `useAuth()` en la línea 27).

`app/(dashboard)/ajustes/page.tsx`:
- línea 52: `const { user, profile, access } = useAuth();`
- línea 54: `const isAdmin = …` → `const canMembers = access.can('invitar_personal') || access.can('gestionar_roles');` (la pestaña Miembros la ve quien invita o quien gestiona roles).
- línea 56: `initialTab`: `canMembers && searchParams.get('tab') === 'miembros' ? 'miembros' : 'general'`.
- líneas 77-84: sustituir `isAdmin` por `canMembers` (el tipo `Tab` de la línea 23 no cambia: sigue sin haber pestaña de roles).
- líneas 89 y 98: `isAdmin` → `canMembers`.
- línea 132: `role={profile?.role}` → `roleLabel={roleBadgeLabel(profile)}`.

`components/features/account/account-tab.tsx`: prop `role: string | undefined` → `roleLabel: string`; el `<Input id="role" value={role || 'User'} … className="… capitalize" />` pasa a `value={roleLabel}` sin `capitalize` (los nombres de rol ya vienen escritos).

- [x] **Paso 6: los consejos por cara, no por rol**

`lib/help/tips.ts:16`: `export type HelpAudience = 'todos' | 'manager' | 'designer';` y las tres entradas `audience: 'ADMIN'` → `audience: 'manager'`. (Los `id` no se tocan.)

`lib/help/select.ts:17-28`:

```ts
import type { ViewMode } from '@/lib/utils/access';

/** Cara de la app del usuario. `undefined` mientras la sesión resuelve. */
export type HelpView = ViewMode | undefined;

/**
 * Consejos que le sirven a una cara de la app.
 *
 * Sin cara resuelta solo pasan los de audiencia 'todos': es preferible enseñar
 * de menos un instante que enseñarle a un diseñador, de refilón, un consejo de
 * gestión mientras la sesión termina de cargar.
 */
export function tipsForView(view: HelpView, tips: readonly HelpTip[] = HELP_TIPS): HelpTip[] {
  return tips.filter((tip) => tip.audience === 'todos' || tip.audience === view);
}
```

`lib/help/select.test.ts:24-39`: `tipsForRole('ADMIN', …)` → `tipsForView('manager', …)`, `'DESIGNER'` → `'designer'`; en las fixtures, `audience: 'ADMIN'` → `'manager'`, `'DESIGNER'` → `'designer'`.

`components/features/help/help-content.tsx:38`: `const visible = useMemo(() => tipsForView(profile ? viewModeFor(profile) : undefined), [profile]);`.

- [x] **Paso 7: borrar `lib/utils/role.ts`** y comprobar con `grep -rn "utils/role'" app lib components` que nadie lo importa (members-panel se cambia en la tarea 7: mientras tanto, sustituir allí `ROLE_ACCENT[m.role]` por `VIEW_MODE_ACCENT[viewModeFor(m)]` y `ROLE_LABELS[m.role]` por `roleBadgeLabel(m)`, y dejar la zona avanzada de «Cambiar rol» tal cual pero sin llamar a nada: `patchUser({ role: nextRole })` → se elimina el botón y el `ConfirmDialog` de rol. La tarea 7 pone lo nuevo).

- [x] **Paso 8: punto de control**

Run: `npx tsc --noEmit && npm run lint && npm test`
Esperado: tipos limpios salvo los sitios de la tarea 5 (las consultas `.eq('role', 'DESIGNER')` no dan error de tipos porque no hay tipos generados: comprobarlos con `grep -rn "eq('role'" app lib`), lint limpio, tests en verde con `tipsForView`.

Commit propuesto (tareas 3+4): `refactor(permisos): la app decide por cara y permiso, no por la casilla del rol`

### Tarea 5: el reparto pregunta por permiso

**Archivos:**
- Usar: `lib/services/profiles/assignable.ts` (creado en la tarea 3)
- Modificar: `lib/hooks/use-team-data.ts:27-30`; `app/api/designs/assign/route.ts:26-36,51-54`; `app/api/designs/bulk/route.ts:48-51`; `app/api/designs/chat/route.ts:94-97`; `lib/services/designs/assignment.ts:23-26`; `app/api/designs/[id]/assignee/route.ts:34-45`
- Modificar: `app/api/users/[id]/route.ts` (entero; los roles se añaden en la tarea 7)

**Interfaces:**
- Consume: `assignableProfiles<T>(supabase, columns)` (tarea 3).

- [x] **Paso 1: sustituir las cinco consultas que quedan**

En cada sitio, `supabase.from('profiles').select(<cols>).eq('role', 'DESIGNER')` → `assignableProfiles<Fila>(supabase, <cols>)`, con la fila tipada a mano:

- `lib/hooks/use-team-data.ts:27-30`: `assignableProfiles<{ id: string; full_name: string | null; display_name: string | null; avatar_url: string | null; weekly_capacity: number | null }>(supabase, 'id, full_name, display_name, avatar_url, weekly_capacity')`.
- `app/api/designs/assign/route.ts:51-54`, `app/api/designs/bulk/route.ts:48-51`, `lib/services/designs/assignment.ts:23-26`: `assignableProfiles(supabase)` (solo `id`, que es el tipo por defecto).
- `app/api/designs/chat/route.ts:94-97`: `assignableProfiles<{ id: string; display_name: string | null; full_name: string | null }>(supabase, 'id, display_name, full_name')`.

- [x] **Paso 2: comprobar que no queda ninguna**

Run: `grep -rn "eq('role'" app lib components`
Esperado: vacío.

(`use-designers.ts` ya se cambió en la tarea 3.)

- [x] **Paso 3: la puerta de repartir en lote**

`app/api/designs/assign/route.ts:26-36`: la comprobación de `ADMIN` pasa a

```ts
  // Reparte cualquiera del departamento creativo: no hay jerarquía dentro (spec §3).
  const access = await loadAccess(supabase, data.user.id);
  if (!access.inDepartment('creativo')) return forbiddenResponse();
```

con `import { loadAccess } from '@/lib/api/access';` y quitando el import de `logger` si queda sin uso.

- [x] **Paso 4: el destino de una reasignación**

`app/api/designs/[id]/assignee/route.ts:34-45`:

```ts
    // El destino tiene que recibir asignaciones: se lo preguntamos a la base,
    // que es quien tiene la respuesta (misma función que usan las políticas).
    const { data: allowed, error: targetError } = await supabase.rpc('has_permission', {
      uid: designer_id,
      perm: 'recibir_asignaciones',
    });
    if (targetError || allowed !== true) {
      return NextResponse.json(
        { error: 'designer_id debe corresponder a alguien que reciba asignaciones' },
        { status: 400 }
      );
    }
```

- [x] **Paso 5: `/api/users/[id]` deja de tocar el rol**

`app/api/users/[id]/route.ts` completo (los `role_ids` llegan en la tarea 7):

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadAccess } from '@/lib/api/access';
import {
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from '@/lib/api/errors';

const updateUserSchema = z
  .object({
    given_name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(80).optional(),
    family_name: z.string().trim().max(80).nullable().optional(),
    alias: z.string().trim().max(80).nullable().optional(),
  })
  .refine((d) => d.given_name !== undefined || d.family_name !== undefined || d.alias !== undefined, {
    message: 'Nada que actualizar',
  });

/**
 * PATCH /api/users/[id] — renombrar a un miembro.
 * Requiere `gestionar_roles`: quien gestiona los roles gestiona también la
 * ficha del compañero. La RLS de `profiles` exige lo mismo, así que no hace
 * falta service-role.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = crypto.randomUUID();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const rawBody = await request.json().catch(() => ({}));
  const parsed = updateUserSchema.safeParse(rawBody);
  if (!parsed.success) return validationErrorResponse(parsed.error, reqId);
  const body = parsed.data;

  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return unauthorizedResponse();

  const access = await loadAccess(supabase, user.id);
  if (!access.can('gestionar_roles')) return forbiddenResponse();

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .single();
  if (targetError || !target) return notFoundResponse('Usuario');

  const updateData: Record<string, unknown> = {};
  if (body.given_name !== undefined) updateData.given_name = body.given_name;
  if (body.family_name !== undefined) updateData.family_name = body.family_name || null;
  if (body.alias !== undefined) updateData.alias = body.alias || null;
  updateData.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select('id, given_name, family_name, alias, full_name, display_name')
    .single();

  if (error) return internalErrorResponse(error, 'user update', reqId);
  return NextResponse.json(updated);
}
```

- [x] **Paso 6: punto de control**

Run: `grep -rn "eq('role'" app lib components; npx tsc --noEmit && npm run lint && npm test`
Esperado: el grep no devuelve nada; el resto limpio.

Comprobación manual en preview (con la 044 aplicada): `/equipo` lista a los cuatro diseñadores; crear un diseño con reparto automático lo asigna a uno de ellos; `/inicio` como Mario enseña el panel de gestión.

Commit propuesto: `refactor(reparto): quién recibe diseños lo decide el permiso, en un solo sitio`

### Tarea 6: invitaciones por rol

**Archivos:**
- Modificar: `components/invitations/create-invitation-dialog.tsx:38,65-72,115-122,166-179`
- Modificar: `app/(auth)/invite/[token]/page.tsx:18-26,69,182`

**Interfaces:**
- Consume: `useRoles()` (tarea 3); `get_invitation_by_token` v2 (`role_name`).

- [x] **Paso 1: el diálogo elige un rol del catálogo**

En `create-invitation-dialog.tsx`:
- línea 3: `import { useEffect, useState } from 'react';` (el efecto de abajo lo necesita).
- línea 38: `const { roles } = useRoles(); const [roleId, setRoleId] = useState<string>('');` y un efecto que fija el primero por defecto cuando llega el catálogo: `useEffect(() => { if (!roleId && roles.length) setRoleId(roles.find((r) => r.name === 'Diseñador')?.id ?? roles[0].id); }, [roles, roleId]);`
- líneas 65-72: el insert pasa a `{ token, role_id: roleId, max_uses: 1, expires_at: expiresAt.toISOString() }` (`role` se deja al valor por defecto de la columna hasta la 046; `created_by` lo pone la base).
- `handleCreate`: si `!roleId`, `toast.error('Elige un rol')` y salir.
- líneas 115-122: `setRole('DESIGNER')` → `setRoleId('')`.
- líneas 166-179: el `Select` recorre `roles`: `<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>`.

- [x] **Paso 2: la página de invitación enseña el nombre del rol**

`app/(auth)/invite/[token]/page.tsx`:
- líneas 18-26: `interface Invitation { id: string; roleName: string | null; }` y borrar `ROLE_LABELS`.
- línea 69: `setInvitation({ id: row.id, roleName: row.role_name ?? null });`
- línea 182: `Rol: {invitation?.roleName ?? 'Miembro'}`.

- [x] **Paso 3: punto de control**

Run: `npx tsc --noEmit && npm run lint`

Manual en preview: crear una invitación de «Diseñador» desde Ajustes → Miembros; abrir el enlace en una ventana privada y ver «Rol: Diseñador».

Límite conocido y aceptado hasta la 046: una invitación creada en preview y abierta **en el dominio de producción** (copiando el token a mano) enseñaría «Rol: Diseñador» aunque fuera de Gestor, porque main todavía lee el texto antiguo. El rol que se concede al aceptar es el correcto; solo miente la etiqueta, y solo en ese cruce de dominios que nadie hace. **No completar el alta** (crearía una cuenta real en producción); Mario decide si quiere probar el alta completa con una cuenta de prueba, y entonces se comprueba en la base que `profile_roles` tiene la fila y `profiles.role` dice `DESIGNER`.

Commit propuesto: `feat(invitaciones): una invitación lleva un rol del catálogo`

### Tarea 7: asignar el rol desde Miembros

Los roles son fijos (no hay pantalla que los edite); lo único que hace la app es decir **qué rol tiene cada compañero**. Un selector con los tres, un rol por persona. La tabla admite varios (para cuando lleguen agentes), pero la pantalla no lo ofrece todavía.

**Archivos:**
- Modificar: `lib/api/errors.ts` (añadir `conflictFromDbError`)
- Modificar: `app/api/users/[id]/route.ts` (añadir `role_ids`)
- Modificar: `components/features/account/members-panel.tsx` (zona avanzada)

**Interfaces:**
- Consume: `useRoles()`, `set_profile_roles`, `Select` de `components/ui/select.tsx` (el mismo del diálogo de invitación).
- Produce: `PATCH /api/users/[id] {role_ids: string[]}`.

- [x] **Paso 1: mapeo de errores de la base**

En `lib/api/errors.ts`, al final:

```ts
/**
 * La guardia de la base (trigger) y los `raise … using errcode = 'check_violation'`
 * llegan como 23514. Se devuelven como 409 con su mensaje, que ya está en castellano.
 */
export function conflictFromDbError(error: { code?: string; message?: string } | null): NextResponse | null {
  if (!error || error.code !== '23514') return null;
  return NextResponse.json({ error: error.message ?? 'Conflicto' }, { status: 409 });
}
```

- [x] **Paso 2: `/api/users/[id]` acepta `role_ids`**

En el esquema de la tarea 5 añadir `role_ids: z.array(z.string().uuid()).min(1, 'Elige un rol').optional(),` y a la condición del `refine`, `|| d.role_ids !== undefined`. Tras comprobar `target`, antes de `updateData`:

```ts
  if (body.role_ids !== undefined) {
    // No te cambias tu propio rol (evita autobloqueo; la guardia de la base cubre el resto).
    if (id === user.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 });
    }
    const { error: rolesError } = await supabase.rpc('set_profile_roles', {
      p_profile_id: id,
      p_role_ids: body.role_ids,
    });
    if (rolesError) return conflictFromDbError(rolesError) ?? internalErrorResponse(rolesError, 'set roles', reqId);
  }

  const hasNameChange = body.given_name !== undefined || body.family_name !== undefined || body.alias !== undefined;
  if (!hasNameChange) return NextResponse.json({ ok: true });
```

Añadir `conflictFromDbError` al import de `@/lib/api/errors`.

- [x] **Paso 3: el selector en Miembros**

En `components/features/account/members-panel.tsx`:
- Imports: quitar `ROLE_ACCENT`; añadir `import { useRoles } from '@/lib/hooks/use-roles';`, `import { roleBadgeLabel, VIEW_MODE_ACCENT, viewModeFor } from '@/lib/utils/access';`, `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';`, y `type Member` en vez de `type Profile`.
- Borrar `ROLE_LABELS` (líneas 29-32), `targetRole` y `nextRole` (54-55), `handleChangeRole` (119-134) y el `ConfirmDialog` de rol (372-385).
- Estado nuevo: `const { roles } = useRoles(); const [roleDraft, setRoleDraft] = useState<string>('');` y en `openMember`: `setRoleDraft(m.roles[0]?.id ?? '');`. `busy` admite `'roles'`.
- `patchUser` acepta `role_ids?: string[]`.
- Distintivos (líneas 189, 197-200, 247, 299-302): `ROLE_ACCENT[m.role]` → `VIEW_MODE_ACCENT[viewModeFor(m)]`; `ROLE_LABELS[m.role]` → `roleBadgeLabel(m)`.
- La zona avanzada (líneas 326-342) pasa a:

```tsx
                        <div className="space-y-3 px-3 pb-3 pt-1">
                          <p className="text-eyebrow text-muted-foreground">Rol</p>
                          <Select value={roleDraft} onValueChange={setRoleDraft}>
                            <SelectTrigger>
                              <SelectValue placeholder="Elige un rol" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setConfirmRole(true)}
                            disabled={!roleDraft || roleDraft === (member.roles[0]?.id ?? '')}
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50 md:h-9"
                          >
                            Cambiar rol
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="flex h-11 w-full items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 md:h-9"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar usuario
                          </button>
                        </div>
```

y el diálogo de confirmación:

```tsx
      <ConfirmDialog
        open={confirmRole}
        onOpenChange={(o) => !o && setConfirmRole(false)}
        onConfirm={handleSaveRole}
        title={`¿Cambiar el rol a ${roles.find((r) => r.id === roleDraft)?.name ?? ''}?`}
        description={`${member?.full_name || 'Este usuario'} pasará a tener los permisos de ese rol y dejará de tener los del actual.`}
        confirmLabel="Cambiar rol"
        variant="warning"
        loading={busy === 'roles'}
      />
```

y

```ts
  const handleSaveRole = async () => {
    if (!member || !roleDraft) return;
    setBusy('roles');
    try {
      await patchUser({ role_ids: [roleDraft] });
      toast.success('Rol actualizado');
      mutate();
      setConfirmRole(false);
      closeMember();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol');
      setConfirmRole(false);
    } finally {
      setBusy(null);
    }
  };
```

- Solo quien tiene `gestionar_roles` ve la zona avanzada: `{!isSelf && access.can('gestionar_roles') && (` (sacar `access` de `useAuth()`). El botón «Invitar miembro» solo con `access.can('invitar_personal')`.
- Cabecera del archivo (líneas 3-11): actualizar el comentario — «Cambiar rol» sigue existiendo pero elige entre los roles de la tabla; el panel lo ve quien invita o gestiona roles.

- [x] **Paso 4: punto de control**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Esperado: todo limpio.

Manual en preview, como Mario:
1. Ajustes → Miembros → Izan → Zona avanzada: el selector dice «Diseñador»; elegir «Diseñador senior», «Cambiar rol», confirmar. Comprobar en la base: `select r.name from public.profile_roles pr join public.roles r on r.id = pr.role_id where pr.profile_id = (select id from public.profiles where display_name = 'Izan')` → una fila, «Diseñador senior». Lo mismo con Lluís. (Este es el paso manual que la 044 dejó para Ajustes.)
2. Abrirse a uno mismo: la zona avanzada no aparece.
3. En `audit_log`: `select action, payload from public.audit_log where entity = 'profile_roles' order by created_at desc limit 4` → dos GRANT y dos REVOKE con `actor_id` de Mario.
4. La guardia contra quedarse sin gestor ya se probó en SQL en la tarea 2; desde la pantalla no hace falta forzarla.

Commit propuesto: `feat(ajustes): el rol de cada compañero se elige desde Miembros`

### Tarea 8: la función de borrar usuarios pregunta por permiso

**Archivos:**
- Modificar: `supabase/functions/admin-delete-user/index.ts:54-60`

- [x] **Paso 1: cambiar la comprobación**

```ts
  const { data: allowed, error: permError } = await admin.rpc("has_permission", {
    uid: caller.id,
    perm: "gestionar_roles",
  });
  if (permError) return json({ error: "Error al verificar permisos" }, 500);
  if (allowed !== true) return json({ error: "Prohibido" }, 403);
```

Y donde la función llama a `admin.auth.admin.deleteUser(userId)` (línea 95), la guardia de la base puede abortar el borrado si esa persona es la última con `gestionar_roles`; traducirlo:

```ts
  if (deleteError) {
    if (String(deleteError.message).includes("gestionar_roles")) {
      return json({ error: "Es la última persona que gestiona roles. Dale el permiso a otra antes de borrarla." }, 409);
    }
    return json({ error: "No se pudo eliminar la cuenta" }, 500);
  }
```

- [ ] **Paso 2: desplegar** con `deploy_edge_function` (MCP) — con el OK de Mario, es producción. Verificar leyendo la función desplegada (`get_edge_function`) y, si Mario quiere, borrando una cuenta de prueba que él cree para eso; no borrar a nadie real.

Commit propuesto: `fix(miembros): borrar un usuario exige gestionar_roles, no la casilla antigua`

**Cierre de la fase 2:** `npm run build` en verde y las comprobaciones manuales de las tareas 5 y 7 hechas. Con eso, preview corre entero sobre roles y permisos aunque las políticas sigan siendo las viejas.

---

## Fase 3 — La base cierra la puerta

### Tarea 9: migración 045

**Archivos:**
- Crear: `supabase/migrations/045_politicas_por_permiso.sql`

**Interfaces:** ninguna nueva. Cambia quién puede qué en `designs`, `profiles`, `invitations`, `invitation_uses`, `audit_log`, `notifications`; `handle_new_user` deja de escribir el rol.

- [x] **Paso 1: escribir el archivo**

```sql
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
```

- [x] **Paso 2: antes de aplicar, confirmar que preview no lee `role`**

Run: `grep -rn "\.role\b\|'ADMIN'\|'DESIGNER'\|eq('role'" app lib components | grep -v "role: 'user'\|role: 'assistant'\|\.role === 'user'\|\.role === 'assistant'"`
Esperado: vacío. Y las comprobaciones manuales de la fase 2 hechas y en verde.

- [ ] **Paso 3: pedir el visto bueno a Mario y aplicar** (`apply_migration`, `name: "politicas_por_permiso"`). Decirle en el mismo mensaje lo único de producción que deja de funcionar hasta el merge: el botón «Cambiar rol» de Miembros (escribe `profiles.role`, que ya no es escribible desde el cliente) devolverá «Error interno del servidor». Todo lo demás de `main` sigue: se recorrió escritura a escritura contra los permisos nuevos.

- [ ] **Paso 4: verificar la RLS con sesiones simuladas**

Postgres deja ejecutar una consulta «como si» fuera otro usuario dentro de una transacción que luego se deshace. Es la prueba real de las políticas, no una lectura del catálogo. Con `execute_sql`:

```sql
-- Una cuenta de fuera (uuid sin perfil, como un futbolista sin roles):
-- no ve diseños, no borra diseños, no ve perfiles.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
select count(*) as ve_disenos from public.designs;
with borrados as (delete from public.designs where true returning 1) select count(*) as borra_disenos from borrados;
select count(*) as ve_perfiles from public.profiles;
rollback;
```
Esperado: `0, 0, 0`.

```sql
-- Loren (Diseñador): ve diseños, ve perfiles, NO ve invitaciones, NO puede
-- hacerse gestor por PostgREST (permiso de columna denegado).
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where display_name = 'Loren'), 'role', 'authenticated')::text, true);
select count(*) > 0 as ve_disenos from public.designs;
select count(*) as ve_perfiles from public.profiles;
select count(*) as ve_invitaciones from public.invitations;
update public.profiles set role = 'ADMIN' where id = (select id from public.profiles where display_name = 'Loren');
rollback;
```
Esperado: `true`, `8`, `0`, y el `update` falla con `permission denied for table profiles` (42501). Si el error aborta la transacción antes del `rollback`, no pasa nada: queda deshecha igual.

```sql
-- Mario (Gestor creativo): ve invitaciones y audit_log.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where display_name = 'Mario'), 'role', 'authenticated')::text, true);
select count(*) >= 0 as ve_invitaciones from public.invitations;
select count(*) > 0 as ve_auditoria from public.audit_log;
rollback;
```
Esperado: `true, true`.

```sql
-- Catálogo final: ninguna política menciona ya el rol antiguo ni is_admin.
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (qual ilike '%role_enum%' or with_check ilike '%role_enum%' or qual ilike '%is_admin%' or with_check ilike '%is_admin%');
```
Esperado: 0 filas.

- [ ] **Paso 5: comprobación manual en preview**

Como Mario: `/inicio`, `/equipo`, `/disenos` funcionan; crear y borrar un diseño de prueba funciona; Ajustes → Miembros lista a todos. Como cuenta «Ver como» Loren: todo se ve igual que antes (recordar que «Ver como» es solo disfraz de frontend; la RLS la prueba el paso 4).

Commit propuesto: `fix(seguridad): las políticas preguntan por permiso; nadie se cambia su propio rol`

---

## Fase 4 — Documentación y remates

### Tarea 10: documentación

**Archivos:**
- Modificar: `docs/estado-y-traspaso.md` (cabecera, «Qué se hizo en septiembre» §3 nuevo, pendientes 4, 5 y 8)
- Modificar: `CLAUDE.md` («Cómo está montado» y «Trampas conocidas»)
- Modificar: `docs/superpowers/specs/2026-09-14-roles-departamentos-y-jugadores-design.md` (§4: estado implementado y la consecuencia de «sin escalafón»)
- Modificar: `e2e/sesion.setup.ts:34-36` (comentario caducado: manager → `/inicio`, diseñador → `/mi-semana`)

- [x] **Paso 1: estado y traspaso**

Añadir en «Qué se hizo en septiembre» un §3 «Permisos por roles» con: qué se hizo (044/045, tres tablas, tres funciones, guardia), los dos agujeros cerrados (pendiente 8 y el de `profiles.role`), el hallazgo de que una cuenta sin roles no ve nada, y **la 046 pendiente hasta el merge a main**. Marcar el pendiente 8 «HECHO el <fecha>», el 5 «HECHO (la invitación lleva `role_id`; la 046 borra el texto)», y en el 4 anotar que `handle_new_user` ya está arreglada e `is_admin` se borra en la 046. Añadir un pendiente nuevo: «Aplicar la 046 tras el merge a main».

- [x] **Paso 2: CLAUDE.md**

En «Cómo está montado», debajo del bloque de `lib/help`:

```
**Los permisos se definen en un solo sitio: `lib/utils/access.ts`.** La base
guarda qué roles hay y qué permisos tiene cada uno, y eso solo lo cambia una
migración (decisión de Mario: sin pantalla de roles); el código dice qué
permisos existen, y Ajustes → Miembros solo elige el rol de cada persona. Para preguntar «¿puede?»: en cliente `useAuth().access.can('…')`,
en rutas de API `loadAccess(supabase, userId)`, y en la base `has_permission(uid, '…')`
dentro de las políticas. Nunca comparar nombres de rol: un rol se puede renombrar.
```

En «Trampas conocidas»: «**Producción y preview comparten base, y `main` va por detrás.** Una migración que quite una columna que `main` todavía lee tumba producción. Por eso las migraciones destructivas (la 046) esperan al merge.»

- [x] **Paso 3: el spec**

En §4, tras «Coste, sin adornos»: «**Implementado el <fecha>** (migraciones 044 y 045; plan en `docs/superpowers/plans/2026-09-16-permisos-rbac.md`).» Y una nota nueva: «**Consecuencia de no tener escalafón:** quien puede invitar puede invitar a cualquier rol, y quien gestiona roles puede dar cualquier permiso. No hay "por encima de". Con ocho personas de confianza es lo correcto; si algún día hace falta, la regla sería "no puedes dar lo que no tienes" y cabe en una función.»

- [ ] **Paso 4: punto de control**

Releer los tres documentos buscando «pendiente» sobre algo ya hecho. `npm run lint` (por si el comentario de e2e).

Commit propuesto: `docs(permisos): queda escrito cómo funcionan los roles y qué falta para borrar el antiguo`

---

## Después del merge a `main`

### Tarea 11: migración 046 — borrar lo antiguo

**Solo cuando `main` lleve el código de este plan desplegado.** Comprobar con `git log --oneline main..preview` (vacío para lo de aquí) y con el panel de Vercel que producción está en ese commit.

**Archivos:**
- Crear: `supabase/migrations/046_adios_role_enum.sql`

- [ ] **Paso 1: escribir el archivo**

```sql
-- 046: se va el rol antiguo.
--
-- Solo se aplica cuando main ya corre el código de roles y permisos: quita
-- columnas que ese código dejó de leer. Hasta entonces, aplicarla tumba
-- producción.

drop function public.is_admin(uuid);

-- La página de invitación ya solo lee role_name.
drop function public.get_invitation_by_token(text);

create function public.get_invitation_by_token(p_token text)
returns table (id uuid, role_name text, valid boolean)
language sql
security definer
set search_path = ''
as $$
  select i.id,
         r.name,
         ((i.expires_at is null or i.expires_at > now())
           and (select count(*) from public.invitation_uses u where u.invitation_id = i.id) < i.max_uses) as valid
  from public.invitations i
  join public.roles r on r.id = i.role_id
  where i.token = p_token;
$$;

-- use_invitation sin el puente al rol antiguo.
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

  insert into public.profile_roles (profile_id, role_id, granted_by)
  values (p_user_id, v_invitation.role_id, v_invitation.created_by)
  on conflict do nothing;

  update public.profiles set kind = 'AGENCIA' where id = p_user_id;

  return true;
end;
$function$;

-- Las invitaciones que main haya creado entre la 044 y hoy solo llevan el
-- texto antiguo: sin este UPDATE el NOT NULL de abajo revienta con 23502.
update public.invitations i
set role_id = r.id
from public.roles r
where i.role_id is null
  and r.name = case i.role when 'ADMIN' then 'Gestor creativo' else 'Diseñador' end;

alter table public.invitations alter column role_id set not null;
alter table public.invitations drop column role;
alter table public.profiles drop column role;
drop type public.role_enum;
```

- [ ] **Paso 2: comprobar el estado vivo**

```sql
select count(*) as invitaciones_sin_rol from public.invitations where role_id is null;
select proname from pg_proc where prosrc ilike '%role_enum%' or prosrc ilike '%profiles.role%' or prosrc ilike '%p.role%';
```
Esperado: la primera puede no ser 0 (las creadas desde main después de la 044): la migración las rellena antes del NOT NULL. La segunda, solo `use_invitation` (la versión de la 044, que esta migración sustituye).

- [ ] **Paso 3: pedir el visto bueno y aplicar** (`name: "adios_role_enum"`).

- [ ] **Paso 4: verificar**

```sql
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';
select exists (select 1 from pg_type where typname = 'role_enum');
```
Esperado: 0 filas; `false`. Y en producción: iniciar sesión como Mario, `/inicio` carga; abrir una invitación nueva en ventana privada muestra «Rol: …».

- [ ] **Paso 5: documentación**

`docs/estado-y-traspaso.md`: pendiente «Aplicar la 046» → HECHO; pendiente 4: `is_admin` fuera. `CLAUDE.md`: nada.

Commit propuesto: `chore(base): se va el rol antiguo; solo quedan roles y permisos`

---

## Autorrevisión (hecha al escribir el plan)

**Cobertura del spec §4:**
- Permisos en código → tarea 1. Roles y persona↔roles en tablas → tarea 2. `AGENCIA|JUGADOR` en el perfil → tarea 2 (`kind`). Los tres roles y las ocho personas → tarea 2 (§9-10) + paso manual de Izan/Lluís en la tarea 7. `has_permission` usada por políticas y servidor → tareas 2, 5, 9. Cambiar un rol cambia a todos → una migración de una fila en `role_permissions` (sin pantalla, por decisión de Mario). Auditoría → `log_rbac_audit`. Nueve políticas → tarea 9 (las nueve, contadas: 4 invitations + 1 invitation_uses + 1 designs + 1 audit_log + 1 notifications + 1 profiles). Una pantalla en Ajustes (el selector de rol en Miembros; la de definir roles se descartó el 2026-09-16) → tarea 7. `search_path` de `handle_new_user` e `is_admin` → tareas 9 y 11. Pendiente 8 → tarea 9.
- «Lo que NO necesita»: ni departamento de agentes ni agente por jugador. No aparecen. ✓

**Lo que este plan decide y el spec no decía** (para que Mario lo vea):
1. **Renombrar a un compañero exige `gestionar_roles`.** Antes era «ADMIN»; el permiso más cercano es ese.
2. **Repartir en lote lo puede cualquiera de creativo.** Antes solo ADMIN; el spec §3 dice que nadie puede menos que otro.
3. **La casilla antigua se borra en una migración aparte (046) tras el merge a main.** No es una decisión de producto, es que comparten base.
4. **Una cuenta sin roles no ve nada.** Cierra de paso que cualquiera con la clave anónima pudiera crearse cuenta y entrar como DESIGNER (el alta usa `signUp` público, así que el registro está abierto).
5. **Insertar avisos a otros sigue cerrado** (ahora `gestionar_roles`, antes ADMIN): cada aviso manda correo y push, y abrirlo a creativo sería un canal de spam entre compañeros. Un diseñador que crea un lote sigue sin aviso agregado, como hoy.
6. **`audit_log` solo lo escribe personal** (`is_staff`), no cualquier sesión. Inocuo: desde el cliente no escribe nadie, los triggers son definer.
7. **Diseñador lleva `invitar_jugadores`.** El spec §4 y el §8 se contradecían; manda el §8, que es lo que Mario confirmó el 2026-09-16, y el §4 se corrige.
8. **Borrar un rol borra sus invitaciones pendientes** (cascade). Con `restrict`, una invitación caducada colgando lo haría imborrable para siempre.

**Revisión externa (contexto limpio, 2026-09-16), ya incorporada:** dos errores de tipos que no compilaban (`normalizeProfile` sobre `any` sin `kind` → `toProfile`; `rpc().select(string)` → `overrideTypes`), el `set not null` de la 046 que reventaría con invitaciones creadas desde main, la política de `notifications` que reabría el spam de la 028, los nombres de registro de las migraciones, la ACL de las funciones para `anon`, el `SIGNED_OUT` sin resetear `access`, el `useEffect` sin importar, y la semilla de `invitar_jugadores`.

**Placeholders:** ninguno; todo el SQL y el TypeScript están escritos. Lo que depende de Mario está marcado como «OK de Mario».

**Tipos coherentes:** `Profile = ProfileWithRoles` (tarea 3) es lo que consumen `viewModeFor`, `deriveAccess`, `roleBadgeLabel` (tareas 4-7). `Designer.roles: ProfileRole[]` alimenta `enterDesignerView(designer)`. `Member` sustituye al `Profile` duplicado de `use-users-data`. `loadAccess` devuelve `Access`, el mismo tipo que `useAuth().access`.

**Cambios de Mario tras ver las pantallas (2026-09-16):** los roles son fijos y sin pantalla (fuera `RolesPanel`, `/api/roles`, `set_role_permissions` y las políticas de escritura sobre `roles`/`role_permissions`); en Miembros un selector con un rol por persona; en el alta del futbolista, «Apellidos» en un solo campo (spec §8).
