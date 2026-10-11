# Campograma, fase 1: el departamento de Agentes — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos llevan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que exista el departamento de Agentes (roles Director y Agente) y que una cuenta de agente entre en la app viendo solo lo suyo, sin poder tocar nada de creativo ni repartir roles de creativo.

**Arquitectura:** primero el código, que pasa a decidir navegación, páginas, Miembros e invitaciones por **departamento** en vez de dar por hecho que toda cuenta de la agencia es de creativo; después una migración que solo añade (roles, permisos, una función para repartir roles dentro de un departamento y políticas acotadas). La lógica nueva vive en funciones puras de `lib/utils/` con sus tests; los componentes solo las usan.

**Stack:** Next.js 15 (App Router) · React 18 · Supabase (Postgres + RLS) · vitest · Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md` (§2, §3 y «Lo que hay que cambiar en la app»). Este plan cubre solo la fase 1 del «Orden de trabajo».

## Restricciones globales

- Rama `feat/campograma`, en la carpeta `.claude/worktrees/campograma` del repo. La carpeta principal (`preview`, con cambios de otra sesión) no se toca.
- **No se hace commit ni push salvo que Mario lo pida** (`CLAUDE.md`). Los pasos «Commit» de este plan se ejecutan solo con esa autorización; si no la hay, se deja el cambio sin commitear y se sigue.
- **La base es la de producción.** La migración solo añade y **se aplica únicamente con permiso expreso de Mario**, en la tarea 6. Cualquier prueba que escriba en la base, aunque sea dentro de una transacción que se deshace, también pide permiso.
- **No se invita a ningún agente real hasta el merge de `preview` a `main`.**
- Castellano en interfaz, comentarios y commits; identificadores en inglés. Los comentarios explican por qué.
- Nunca comparar nombres de rol en código (regla `permisos.md`). Los permisos se definen en `lib/utils/access.ts`.
- Cada consulta nueva en el middleware la pagan todas las navegaciones (regla `region-y-middleware.md`): **esta fase no añade ninguna**.
- Sin dependencias nuevas.
- Después de cada tarea: `npx tsc --noEmit`, `npm run lint` y `npm test` en verde, y contarlo antes de seguir.

## Foco de revisión

Casos que el spec implica y que ningún test obvio cubre; cada uno tiene su comprobación en la tarea que lo posee.

1. **Cuenta de la agencia sin ningún rol** (por ejemplo, un alta a medias): hoy ve la app vacía; no puede quedarse en blanco ni en un bucle de redirecciones. → Test en la tarea 2 (`canEnterRoute`).
2. **Persona con roles en los dos departamentos** (Mario el día que tenga uno de Agentes): cambiarle el rol de un departamento no puede quitarle el del otro. → Comprobación SQL en la tarea 6.
3. **Invitaciones creadas desde producción** (`main` no rellena `role_id`): tienen que seguir funcionando igual tras la migración. → Comprobación SQL en la tarea 6.
4. **Un director que intenta dar un rol de creativo**, desde la app o con una petición directa a la base: rechazado. → Test en la tarea 4 (`departmentsManagedBy`) y comprobación SQL en la tarea 6.
5. **Un agente dado de alta por invitación no puede aparecer como diseñador en producción** (`main` toma por diseñador a todo `profiles.role = 'DESIGNER'` y le reparte trabajo). → Definición comprobada en la tarea 6 y cuenta de prueba en la tarea 9.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `lib/utils/access.ts` | Departamento `agentes`, permisos `invitar_agentes` y `gestionar_agentes`, cara `agent`, y tres funciones puras para Miembros e invitaciones |
| `lib/utils/access.test.ts` | Tests de lo anterior |
| `lib/utils/navigation.ts` (nuevo) | Qué ruta es de qué departamento y qué entradas de navegación ve cada cuenta |
| `lib/utils/navigation.test.ts` (nuevo) | Sus tests |
| `components/layout/department-gate.tsx` (nuevo) | Saca de una página a quien no es de su departamento |
| `app/(dashboard)/layout.tsx` | Monta la puerta |
| `app/(dashboard)/campograma/page.tsx` (nuevo) | Página de entrada de los agentes, vacía hasta la fase 3 |
| `components/layout/app-sidebar.tsx` | Navegación por departamento |
| `components/layout/mobile-tab-bar.tsx` | Ídem, y el «+» de crear diseños solo para creativo |
| `lib/help/select.ts`, `lib/help/select.test.ts` | Qué consejos ve la cara de agente |
| `components/features/account/members-panel.tsx` | Lista, nombres y rol acotados por departamento |
| `components/invitations/create-invitation-dialog.tsx` | Solo los roles a los que se puede invitar |
| `app/api/users/[id]/route.ts` | Cambiar el rol de un departamento, con el permiso que toca |
| `lib/hooks/use-users-data.ts`, `components/layout/user-menu.tsx`, `app/(dashboard)/ajustes/page.tsx` | Quién ve Miembros |
| `supabase/migrations/050_agentes_roles_y_permisos.sql` (nuevo) | Roles, permisos, función y políticas |
| `docs/estado-y-traspaso.md`, `.claude/rules/permisos.md`, `CLAUDE.md` | Documentación |

El número **049 está reservado** para la migración que borra el rol antiguo tras el merge (pendiente 11 de `estado-y-traspaso.md`). Esta es la **050**.

---

### Tarea 0: Preparar la carpeta de trabajo

**Archivos:** ninguno versionado.

- [ ] **Paso 1: enlazar dependencias y entorno de la carpeta principal**

La carpeta de trabajo no tiene `node_modules` ni `.env.local`. Se enlazan; no se copian (el `.env.local` lleva claves y no se imprime).

```bash
cd /Users/rodz/Developer/phsport-app/.claude/worktrees/campograma
ln -s ../../../node_modules node_modules
ln -s ../../../.env.local .env.local
git status --short
```

Esperado: `git status` no lista ninguno de los dos (`node_modules` y `.env*.local` están en `.gitignore`). Si aparecen, **parar** y añadirlos a `.git/info/exclude`, no al `.gitignore`.

- [ ] **Paso 2: línea base**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Esperado: todo en verde. Anotar el número de tests que pasan; es la referencia para las tareas siguientes.

---

### Tarea 1: Permisos, departamentos y la cara de agente

**Archivos:**
- Modificar: `lib/utils/access.ts`
- Test: `lib/utils/access.test.ts`

**Interfaces:**
- Produce: `Department` incluye `'agentes'`; `Permission` incluye `'invitar_agentes' | 'gestionar_agentes'`; `ViewMode` incluye `'agent'`; `homeFor('agent') === '/campograma'`; `VIEW_MODE_ACCENT.agent`.

- [ ] **Paso 1: escribir los tests que fallan**

Añadir al final de `lib/utils/access.test.ts`:

```ts
const agente = {
  id: 'r5',
  name: 'Agente',
  department: 'agentes' as const,
  permissions: [] as const,
};
const director = {
  id: 'r4',
  name: 'Director',
  department: 'agentes' as const,
  permissions: ['invitar_agentes', 'gestionar_agentes'] as const,
};

describe('la cara de agente', () => {
  const withRoles = (roles: ProfileWithRoles['roles']): ProfileWithRoles => ({ ...base, roles });

  it('quien solo es de Agentes ve la cara de agente y entra al campograma', () => {
    expect(viewModeFor(withRoles([agente]))).toBe('agent');
    expect(viewModeFor(withRoles([director]))).toBe('agent');
    expect(homeFor('agent')).toBe('/campograma');
  });

  it('quien es de los dos departamentos conserva su cara de creativo', () => {
    expect(viewModeFor(withRoles([gestor, director]))).toBe('manager');
    expect(viewModeFor(withRoles([disenador, agente]))).toBe('designer');
  });

  it('un rol de Agentes da el departamento aunque no traiga permisos', () => {
    const a = deriveAccess(withRoles([agente]));
    expect(a.inDepartment('agentes')).toBe(true);
    expect(a.inDepartment('creativo')).toBe(false);
  });

  it('normalizeProfile ya no descarta el departamento de Agentes', () => {
    const raw = {
      ...base,
      profile_roles: [
        {
          role: {
            id: 'r4',
            name: 'Director',
            department: 'agentes',
            role_permissions: [{ permission: 'invitar_agentes' }, { permission: 'gestionar_agentes' }],
          },
        },
      ],
    };
    expect(normalizeProfile(raw).roles).toEqual([director]);
  });
});
```

- [ ] **Paso 2: comprobar que fallan**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: FALLA (`'agentes'` no es un departamento, `'agent'` no es una cara).

- [ ] **Paso 3: implementar**

En `lib/utils/access.ts`, sustituir las dos constantes:

```ts
export const PERMISSIONS = [
  'invitar_personal',
  'invitar_jugadores',
  'gestionar_roles',
  'recibir_asignaciones',
  // Los de Agentes van aparte de los de creativo a propósito: `gestionar_roles`
  // y `invitar_personal` abren también borrar cuentas, leer la auditoría y
  // mandar avisos, y un director no debe tener nada de eso.
  'invitar_agentes',
  'gestionar_agentes',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEPARTMENTS = ['creativo', 'agentes'] as const;
```

Sustituir el tipo `ViewMode` y `viewModeFor`:

```ts
export type ViewMode = 'manager' | 'designer' | 'agent' | 'player';

export function viewModeFor(
  profile: Pick<ProfileWithRoles, 'kind' | 'roles'> | null | undefined
): ViewMode {
  if (!profile) return 'designer';
  if (profile.kind === 'JUGADOR') return 'player';
  const access = deriveAccess(profile);
  // Solo es «agente» quien no tiene nada en creativo: quien tiene los dos
  // departamentos conserva su cara de creativo y ve el campograma como una
  // entrada más de la navegación.
  if (!access.inDepartment('creativo') && access.inDepartment('agentes')) return 'agent';
  return access.can('recibir_asignaciones') ? 'designer' : 'manager';
}
```

En `homeFor`, añadir el caso antes de `default`:

```ts
    case 'agent':
      return '/campograma';
```

Y en `VIEW_MODE_ACCENT`, añadir la entrada (colores solo por token):

```ts
  agent: 'bg-foreground/10 text-foreground',
```

- [ ] **Paso 4: comprobar que pasan**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: PASA, incluidos los tests que ya existían.

- [ ] **Paso 5: tipos**

Run: `npx tsc --noEmit`
Esperado: sin errores. Si algún `switch` o `Record<ViewMode, …>` se queja por `'agent'`, es la tarea 3 (`lib/help/select.ts`) o un sitio no previsto: anotarlo y resolverlo en su tarea, no con un cast.

- [ ] **Paso 6: commit (solo con autorización de Mario)**

```bash
git add lib/utils/access.ts lib/utils/access.test.ts
git commit -m "feat(agentes): la app conoce el departamento de Agentes y su cara"
```

---

### Tarea 2: Cada ruta es de un departamento, y la navegación también

**Archivos:**
- Crear: `lib/utils/navigation.ts`, `lib/utils/navigation.test.ts`
- Crear: `components/layout/department-gate.tsx`
- Crear: `app/(dashboard)/campograma/page.tsx`
- Modificar: `app/(dashboard)/layout.tsx`, `components/layout/app-sidebar.tsx`, `components/layout/mobile-tab-bar.tsx`

**Interfaces:**
- Consume: `Access`, `Department`, `ViewMode`, `homeFor`, `viewModeFor` (tarea 1).
- Produce: `routeDepartment(pathname: string): Department | null`, `canEnterRoute(pathname: string, access: Pick<Access, 'inDepartment' | 'departments'>): boolean`, `showsCreative(access): boolean`, `type NavKey`, `navKeysFor(access): NavKey[]`, `buildNavItems(mode: ViewMode, access): NavItem[]`.

- [ ] **Paso 1: escribir los tests que fallan**

Crear `lib/utils/navigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveAccess, type ProfileRole } from './access';
import { canEnterRoute, navKeysFor, routeDepartment, showsCreative } from './navigation';

const role = (department: 'creativo' | 'agentes'): ProfileRole => ({
  id: department,
  name: department,
  department,
  permissions: [],
});
const accessWith = (...roles: ProfileRole[]) => deriveAccess({ kind: 'AGENCIA', roles });

describe('routeDepartment', () => {
  it('las pantallas de diseños y fichas son de creativo', () => {
    for (const p of ['/inicio', '/mi-semana', '/equipo', '/equipo/abc', '/disenos', '/jugadores/x']) {
      expect(routeDepartment(p)).toBe('creativo');
    }
  });
  it('el campograma es de Agentes', () => {
    expect(routeDepartment('/campograma')).toBe('agentes');
  });
  it('lo común no es de nadie', () => {
    for (const p of ['/ajustes', '/ayuda', '/']) expect(routeDepartment(p)).toBeNull();
  });
  it('no confunde un prefijo con una ruta', () => {
    expect(routeDepartment('/inicio-viejo')).toBeNull();
  });
});

describe('canEnterRoute', () => {
  it('un agente no entra en creativo y sí en el campograma y en lo común', () => {
    const a = accessWith(role('agentes'));
    expect(canEnterRoute('/disenos', a)).toBe(false);
    expect(canEnterRoute('/campograma', a)).toBe(true);
    expect(canEnterRoute('/ajustes', a)).toBe(true);
  });
  it('creativo no entra en el campograma', () => {
    expect(canEnterRoute('/campograma', accessWith(role('creativo')))).toBe(false);
  });
  it('con los dos departamentos entra en todo', () => {
    const a = accessWith(role('creativo'), role('agentes'));
    expect(canEnterRoute('/disenos', a)).toBe(true);
    expect(canEnterRoute('/campograma', a)).toBe(true);
  });
  it('una cuenta sin roles no se queda en blanco: pasa como hasta ahora', () => {
    expect(canEnterRoute('/inicio', accessWith())).toBe(true);
  });
});

describe('navKeysFor', () => {
  it('creativo ve sus cuatro entradas', () => {
    expect(navKeysFor(accessWith(role('creativo')))).toEqual(['inicio', 'semana', 'disenos', 'jugadores']);
  });
  it('un agente solo ve el campograma', () => {
    expect(navKeysFor(accessWith(role('agentes')))).toEqual(['campograma']);
  });
  it('con los dos, el campograma va al final', () => {
    expect(navKeysFor(accessWith(role('creativo'), role('agentes')))).toEqual([
      'inicio',
      'semana',
      'disenos',
      'jugadores',
      'campograma',
    ]);
  });
  it('sin roles (o con la sesión aún cargando) se ve lo de creativo, como hasta ahora', () => {
    expect(showsCreative(accessWith())).toBe(true);
    expect(navKeysFor(accessWith())).toEqual(['inicio', 'semana', 'disenos', 'jugadores']);
  });
});
```

- [ ] **Paso 2: comprobar que fallan**

Run: `npx vitest run lib/utils/navigation.test.ts`
Esperado: FALLA (el módulo no existe).

- [ ] **Paso 3: implementar `lib/utils/navigation.ts`**

```ts
/**
 * Qué pantallas son de qué departamento, y qué entradas de navegación ve cada
 * cuenta. Lógica pura: la usan la barra lateral, la tab bar y la puerta de
 * `app/(dashboard)/layout.tsx`.
 *
 * Hasta la fase 1 del campograma toda cuenta de la agencia era de creativo y
 * nada de esto hacía falta (spec 2026-10-11, «Lo que hay que cambiar»).
 */

import type { Access, Department } from './access';

const ROUTE_DEPARTMENTS: ReadonlyArray<readonly [string, Department]> = [
  ['/inicio', 'creativo'],
  ['/mi-semana', 'creativo'],
  ['/equipo', 'creativo'],
  ['/disenos', 'creativo'],
  ['/jugadores', 'creativo'],
  ['/campograma', 'agentes'],
];

/** El departamento dueño de una ruta, o null si es de todos (ajustes, ayuda). */
export function routeDepartment(pathname: string): Department | null {
  const hit = ROUTE_DEPARTMENTS.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  return hit ? hit[1] : null;
}

type DepartmentAccess = Pick<Access, 'inDepartment' | 'departments'>;

/**
 * Sin ningún departamento —alta a medias, o la sesión aún resolviendo— se
 * comporta como antes: ve lo de creativo y la base no le da datos. Sin esto,
 * una cuenta sin roles quedaba en blanco o rebotando hacia /inicio.
 */
export function showsCreative(access: DepartmentAccess): boolean {
  return access.departments.size === 0 || access.inDepartment('creativo');
}

export function canEnterRoute(pathname: string, access: DepartmentAccess): boolean {
  const department = routeDepartment(pathname);
  if (!department) return true;
  if (department === 'creativo') return showsCreative(access);
  return access.inDepartment(department);
}

export type NavKey = 'inicio' | 'semana' | 'disenos' | 'jugadores' | 'campograma';

export function navKeysFor(access: DepartmentAccess): NavKey[] {
  const keys: NavKey[] = [];
  if (showsCreative(access)) keys.push('inicio', 'semana', 'disenos', 'jugadores');
  if (access.inDepartment('agentes')) keys.push('campograma');
  return keys;
}
```

- [ ] **Paso 4: comprobar que pasan**

Run: `npx vitest run lib/utils/navigation.test.ts`
Esperado: PASA.

- [ ] **Paso 5: la barra lateral usa `navKeysFor`**

En `components/layout/app-sidebar.tsx`, añadir `Goal` a la importación de `lucide-react` y sustituir `buildNavItems` entera:

```ts
import { navKeysFor, type NavKey } from '@/lib/utils/navigation';
import type { Access, ViewMode } from '@/lib/utils/access';

const NAV_ITEMS: Record<NavKey, (mode: ViewMode) => NavItem> = {
  inicio: () => ({ href: '/inicio', label: 'Inicio', icon: Home }),
  // Vista semanal de trabajo: el equipo (gestión) o la cola propia (quien recibe diseños).
  semana: (mode) =>
    mode === 'manager'
      ? { href: '/equipo', label: 'Semana', icon: CalendarRange }
      : { href: '/mi-semana', label: 'Semana', icon: CalendarRange },
  disenos: () => ({ href: '/disenos', label: 'Diseños', icon: Palette }),
  // La cartera de fichas es de todo el departamento creativo (spec §5).
  jugadores: () => ({ href: '/jugadores', label: 'Jugadores', icon: Users }),
  campograma: () => ({ href: '/campograma', label: 'Campograma', icon: Goal }),
};

/** Entradas de navegación por departamento. La tab bar se adapta al número. */
export function buildNavItems(
  mode: ViewMode,
  access: Pick<Access, 'inDepartment' | 'departments'>
): NavItem[] {
  return navKeysFor(access).map((key) => NAV_ITEMS[key](mode));
}
```

Si `ViewMode` ya se importaba en ese archivo, no duplicar la importación. En `AppSidebar`:

```ts
  const { profile, access } = useAuth();
  const pathname = usePathname() ?? '';
  const items = buildNavItems(viewModeFor(profile), access);
```

- [ ] **Paso 6: la tab bar, igual, y el «+» solo para creativo**

En `components/layout/mobile-tab-bar.tsx`:

```ts
import { showsCreative } from '@/lib/utils/navigation';
```

```ts
  const { profile, access } = useAuth();
```

```ts
  const items = buildNavItems(viewModeFor(profile), access);
  // Crear diseños es de creativo: a un agente el «+» le abriría un diálogo
  // que la base no le deja usar.
  const canCreateDesigns = showsCreative(access);
```

Y envolver el botón de crear (el `<button … aria-label="Crear diseños">`, hasta su `</button>`) en `{canCreateDesigns && ( … )}`. El diálogo de debajo (`createMounted && …`) no cambia: sin botón nunca se monta.

- [ ] **Paso 7: la puerta de las páginas**

Crear `components/layout/department-gate.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor } from '@/lib/utils/access';
import { canEnterRoute } from '@/lib/utils/navigation';

/**
 * Saca de una pantalla a quien no es de su departamento y lo manda a su casa.
 * Un solo sitio para todas las rutas del panel, en vez de una guarda por
 * página: con dos departamentos, la página que se olvidara la guarda quedaba
 * abierta. La base ya impide leer los datos; esto evita enseñar la pantalla.
 *
 * Mientras la sesión resuelve, deja pasar: cada página pinta su esqueleto.
 */
export function DepartmentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { profile, access, status } = useAuth();
  const denied = status !== 'INITIALIZING' && !!profile && !canEnterRoute(pathname, access);

  useEffect(() => {
    if (denied) router.replace(homeFor(viewModeFor(profile)));
  }, [denied, profile, router]);

  if (denied) return null;
  return <>{children}</>;
}
```

En `app/(dashboard)/layout.tsx`:

```tsx
import { AppLayout } from '@/components/layout/app-layout';
import { DepartmentGate } from '@/components/layout/department-gate';
import { ViewAsProvider } from '@/lib/auth/view-as-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewAsProvider>
      <AppLayout>
        <DepartmentGate>{children}</DepartmentGate>
      </AppLayout>
    </ViewAsProvider>
  );
}
```

Las guardas que ya existen (`useRequireDepartment` en Jugadores, la de `equipo`) se quedan: son redundantes pero inofensivas, y quitarlas no es de esta tarea.

- [ ] **Paso 8: la página de entrada de los agentes**

Crear `app/(dashboard)/campograma/page.tsx`. Va vacía hasta la fase 3; sin texto de relleno.

```tsx
'use client';

import { DashboardPage } from '@/components/ui/dashboard-page';
import { useAuth } from '@/lib/auth/auth-context';

/** Entrada del departamento de Agentes. El campograma llega en la fase 3. */
export default function CampogramaPage() {
  const { status } = useAuth();
  return (
    <DashboardPage title="Campograma" loading={status === 'INITIALIZING'} skeleton={null}>
      {null}
    </DashboardPage>
  );
}
```

- [ ] **Paso 9: tipos, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Esperado: todo en verde; tests = línea base + los nuevos.

- [ ] **Paso 10: commit (solo con autorización de Mario)**

```bash
git add lib/utils/navigation.ts lib/utils/navigation.test.ts components/layout/department-gate.tsx \
  app/\(dashboard\)/layout.tsx app/\(dashboard\)/campograma/page.tsx \
  components/layout/app-sidebar.tsx components/layout/mobile-tab-bar.tsx
git commit -m "feat(agentes): cada pantalla es de un departamento y un agente solo ve el campograma"
```

---

### Tarea 3: Los consejos de la cara de agente

**Archivos:**
- Modificar: `lib/help/select.ts`
- Test: `lib/help/select.test.ts`

Hoy `audience: 'todos'` significa «todo creativo»: casi todos hablan de diseños. Un agente solo debe ver los de la sección `cuenta` (notificaciones, instalar la app, atajos). Los `id` no se tocan: son anclas públicas.

- [ ] **Paso 1: test que falla**

Añadir a `lib/help/select.test.ts` (respetando sus imports; `tipsForView` ya está importado allí):

```ts
describe('tipsForView con la cara de agente', () => {
  it('solo pasan los consejos de la cuenta', () => {
    const tips = tipsForView('agent');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.every((t) => t.section === 'cuenta')).toBe(true);
  });
});
```

- [ ] **Paso 2: comprobar que falla**

Run: `npx vitest run lib/help/select.test.ts`
Esperado: FALLA (pasan también los de `buscar`, `reparto`…).

- [ ] **Paso 3: implementar**

En `tipsForView`:

```ts
export function tipsForView(view: HelpView, tips: readonly HelpTip[] = HELP_TIPS): HelpTip[] {
  // «todos» se escribió cuando todo el mundo era de creativo: casi todos esos
  // consejos hablan de diseños. A un agente solo le sirven los de su cuenta.
  if (view === 'agent') return tips.filter((tip) => tip.audience === 'todos' && tip.section === 'cuenta');
  return tips.filter((tip) => tip.audience === 'todos' || tip.audience === view);
}
```

- [ ] **Paso 4: comprobar que pasa**

Run: `npx vitest run lib/help/select.test.ts`
Esperado: PASA.

- [ ] **Paso 5: commit (solo con autorización de Mario)**

```bash
git add lib/help/select.ts lib/help/select.test.ts
git commit -m "feat(agentes): un agente solo ve en Ayuda los consejos de su cuenta"
```

---

### Tarea 4: Miembros e invitaciones, acotados por departamento

**Archivos:**
- Modificar: `lib/utils/access.ts`, `lib/utils/access.test.ts`
- Modificar: `components/features/account/members-panel.tsx`, `components/invitations/create-invitation-dialog.tsx`
- Modificar: `app/api/users/[id]/route.ts`
- Modificar: `lib/hooks/use-users-data.ts`, `components/layout/user-menu.tsx`, `app/(dashboard)/ajustes/page.tsx`

**Interfaces:**
- Consume: `Permission`, `Department`, `DEPARTMENTS` (tarea 1); `RoleWithPermissions` de `lib/hooks/use-roles.ts`.
- Produce:
  - `departmentsManagedBy(access: Pick<Access, 'can'>): Department[]`
  - `departmentsInvitableBy(access: Pick<Access, 'can'>): Department[]`
  - `canSeeMembers(access: Pick<Access, 'can'>): boolean`
  - `membersVisibleTo<T extends Pick<ProfileWithRoles, 'roles'>>(members: T[], access: Pick<Access, 'can'>): T[]`
  - `defaultInviteRole<R extends { id: string; department: Department; permissions: readonly Permission[] }>(roles: R[], departments: Department[]): R | undefined`
  - API: `PATCH /api/users/[id]` acepta `department_role: { department: Department; role_id: string }` en vez de `role_ids`. Llama a la RPC `set_department_role(p_profile_id, p_department, p_role_id)` (tarea 5).

Reglas que implementan (spec §2):

| Quién | Reparte roles de | Invita a roles de |
|---|---|---|
| `gestionar_roles` (Gestor creativo, Mario) | Creativo y Agentes | Creativo y Agentes |
| `gestionar_agentes` / `invitar_agentes` (Director) | Agentes | Agentes |
| `invitar_personal` (Diseñador senior) | — | Creativo |

- [ ] **Paso 1: tests que fallan**

Añadir a `lib/utils/access.test.ts` (y añadir `canSeeMembers`, `defaultInviteRole`, `departmentsInvitableBy`, `departmentsManagedBy` y `membersVisibleTo` a su import de `./access`):

```ts
describe('Miembros e invitaciones por departamento', () => {
  const acc = (...roles: ProfileWithRoles['roles']) => deriveAccess({ ...base, roles });
  const senior = {
    id: 'r2',
    name: 'Diseñador senior',
    department: 'creativo' as const,
    permissions: ['invitar_personal', 'invitar_jugadores', 'recibir_asignaciones'] as const,
  };

  it('quien gestiona roles reparte e invita en los dos departamentos', () => {
    expect(departmentsManagedBy(acc(gestor))).toEqual(['creativo', 'agentes']);
    expect(departmentsInvitableBy(acc(gestor))).toEqual(['creativo', 'agentes']);
  });

  it('un director solo reparte e invita en Agentes', () => {
    expect(departmentsManagedBy(acc(director))).toEqual(['agentes']);
    expect(departmentsInvitableBy(acc(director))).toEqual(['agentes']);
  });

  it('un senior invita a creativo pero no reparte roles', () => {
    expect(departmentsManagedBy(acc(senior))).toEqual([]);
    expect(departmentsInvitableBy(acc(senior))).toEqual(['creativo']);
  });

  it('ver Miembros: quien invita o reparte algo; un agente o un diseñador, no', () => {
    expect(canSeeMembers(acc(director))).toBe(true);
    expect(canSeeMembers(acc(senior))).toBe(true);
    expect(canSeeMembers(acc(agente))).toBe(false);
    expect(canSeeMembers(acc(disenador))).toBe(false);
  });

  it('un director solo ve en Miembros a la gente de Agentes', () => {
    const people = [
      { id: 'a', roles: [disenador] },
      { id: 'b', roles: [agente] },
      { id: 'c', roles: [gestor, director] },
    ];
    expect(membersVisibleTo(people, acc(director)).map((p) => p.id)).toEqual(['b', 'c']);
    expect(membersVisibleTo(people, acc(gestor)).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('el rol por defecto al invitar es el de menos permisos del primer departamento', () => {
    const roles = [gestor, disenador, director, agente];
    expect(defaultInviteRole(roles, ['creativo', 'agentes'])?.id).toBe('r3');
    expect(defaultInviteRole(roles, ['agentes'])?.id).toBe('r5');
    expect(defaultInviteRole([], ['agentes'])).toBeUndefined();
  });
});
```

- [ ] **Paso 2: comprobar que fallan**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: FALLA (las funciones no existen).

- [ ] **Paso 3: implementar en `lib/utils/access.ts`**

Al final del archivo:

```ts
/**
 * Departamentos cuyos roles puede repartir esta cuenta en Miembros.
 * `gestionar_roles` es el de siempre y vale para todos; `gestionar_agentes`
 * solo para Agentes (spec 2026-10-11 §2: un director no hace a nadie Gestor
 * creativo).
 */
export function departmentsManagedBy(access: Pick<Access, 'can'>): Department[] {
  if (access.can('gestionar_roles')) return [...DEPARTMENTS];
  return access.can('gestionar_agentes') ? ['agentes'] : [];
}

/** Departamentos a cuyos roles puede invitar. Misma regla que la RLS de `invitations` (migración 050). */
export function departmentsInvitableBy(access: Pick<Access, 'can'>): Department[] {
  if (access.can('gestionar_roles')) return [...DEPARTMENTS];
  const out: Department[] = [];
  if (access.can('invitar_personal')) out.push('creativo');
  if (access.can('invitar_agentes')) out.push('agentes');
  return out;
}

export function canSeeMembers(access: Pick<Access, 'can'>): boolean {
  return departmentsManagedBy(access).length > 0 || departmentsInvitableBy(access).length > 0;
}

/**
 * A quién ve en Miembros. Quien gestiona roles, a todos; el resto, solo a la
 * gente de los departamentos en los que invita o reparte. Ver nombres ajenos
 * no es un riesgo (la base deja leer perfiles a todo el personal), pero una
 * tarjeta que no puedes tocar es ruido.
 */
export function membersVisibleTo<T extends Pick<ProfileWithRoles, 'roles'>>(
  members: T[],
  access: Pick<Access, 'can'>
): T[] {
  if (access.can('gestionar_roles')) return members;
  const depts = new Set<Department>([...departmentsManagedBy(access), ...departmentsInvitableBy(access)]);
  return members.filter((m) => m.roles.some((r) => depts.has(r.department)));
}

/**
 * Rol que viene marcado al invitar: el de menos permisos del primer
 * departamento que tenga roles. Así sale «Diseñador» para creativo y «Agente»
 * para Agentes sin comparar nombres (un rol se puede renombrar).
 */
export function defaultInviteRole<
  R extends { id: string; department: Department; permissions: readonly Permission[] },
>(roles: R[], departments: Department[]): R | undefined {
  for (const d of departments) {
    const inDept = roles.filter((r) => r.department === d);
    if (inDept.length) {
      return inDept.reduce((least, r) => (r.permissions.length < least.permissions.length ? r : least));
    }
  }
  return undefined;
}
```

- [ ] **Paso 4: comprobar que pasan**

Run: `npx vitest run lib/utils/access.test.ts`
Esperado: PASA.

- [ ] **Paso 5: quién ve Miembros, en un solo sitio**

Sustituir la expresión `access.can('invitar_personal') || access.can('gestionar_roles')` por `canSeeMembers(access)` en los tres sitios, importando `canSeeMembers` de `@/lib/utils/access`:

- `lib/hooks/use-users-data.ts`: `const allowed = status === 'AUTHENTICATED' && canSeeMembers(access);`, y actualizar su comentario («Solo quien invita o reparte roles lo pide.»).
- `components/layout/user-menu.tsx`: `const canMembers = canSeeMembers(access);`
- `app/(dashboard)/ajustes/page.tsx`: `const canMembers = canSeeMembers(access);`, y el comentario de encima: «La pestaña Miembros la ve quien invita o reparte roles en algún departamento.»

Run: `grep -rn "can('invitar_personal') || access.can('gestionar_roles')" app components lib`
Esperado: sin resultados.

- [ ] **Paso 6: la ruta de la API cambia el rol de un departamento**

Sustituir `app/api/users/[id]/route.ts` entero:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadAccess } from '@/lib/api/access';
import { DEPARTMENTS, departmentsManagedBy } from '@/lib/utils/access';
import {
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictFromDbError,
} from '@/lib/api/errors';

const updateUserSchema = z
  .object({
    given_name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(80).optional(),
    family_name: z.string().trim().max(80).nullable().optional(),
    alias: z.string().trim().max(80).nullable().optional(),
    // El rol de UN departamento. Antes era «que le queden exactamente estos
    // roles», y con dos departamentos eso borraba el del otro al cambiar uno.
    department_role: z
      .object({ department: z.enum(DEPARTMENTS), role_id: z.string().uuid() })
      .optional(),
  })
  .refine(
    (d) =>
      d.given_name !== undefined ||
      d.family_name !== undefined ||
      d.alias !== undefined ||
      d.department_role !== undefined,
    { message: 'Nada que actualizar' }
  );

/**
 * PATCH /api/users/[id] — renombrar a un miembro y/o cambiarle el rol de un
 * departamento.
 * - Renombrar exige `gestionar_roles`: es la ficha del compañero.
 * - El rol exige poder repartir en ESE departamento (`departmentsManagedBy`):
 *   un director cambia entre Agente y Director, nada de creativo.
 * La RLS de `profiles` y `profile_roles` exige lo mismo (migraciones 045 y
 * 050), así que no hace falta service-role. La guardia de la base impide
 * quedarse sin nadie que gestione roles; aquí solo se traduce su error.
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
  const hasNameChange = body.given_name !== undefined || body.family_name !== undefined || body.alias !== undefined;
  if (hasNameChange && !access.can('gestionar_roles')) return forbiddenResponse();
  if (body.department_role && !departmentsManagedBy(access).includes(body.department_role.department)) {
    return forbiddenResponse();
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .single();
  if (targetError || !target) return notFoundResponse('Usuario');

  if (body.department_role) {
    // No te cambias tu propio rol (evita autobloqueo; la guardia de la base cubre el resto).
    if (id === user.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 });
    }
    const { error: rolesError } = await supabase.rpc('set_department_role', {
      p_profile_id: id,
      p_department: body.department_role.department,
      p_role_id: body.department_role.role_id,
    });
    if (rolesError) return conflictFromDbError(rolesError) ?? internalErrorResponse(rolesError, 'set role', reqId);
  }

  if (!hasNameChange) return NextResponse.json({ ok: true });

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

Comprobar que nadie más usa `role_ids`:

Run: `grep -rn "role_ids" app components lib`
Esperado: solo `members-panel.tsx`, que se cambia en el paso siguiente.

- [ ] **Paso 7: el panel de Miembros**

En `components/features/account/members-panel.tsx`:

1. Imports: añadir `departmentsManagedBy, membersVisibleTo, type Department` a la importación de `@/lib/utils/access`.

2. Al principio del componente, sustituir la línea de `useUsersData` y las derivadas del rol:

```ts
  const { users: allUsers, mutate } = useUsersData();
  const users = membersVisibleTo(allUsers, access);
  const managed = departmentsManagedBy(access);
  const canRename = access.can('gestionar_roles');
```

Sustituir el estado `roleDraft` por uno por departamento, y lo que dependía de él:

```ts
  // Un borrador de rol por departamento: Mario puede tener uno de creativo y
  // otro de Agentes, y cambiar uno no toca el otro.
  const [roleDrafts, setRoleDrafts] = useState<Partial<Record<Department, string>>>({});
  const [confirmDept, setConfirmDept] = useState<Department | null>(null);
```

```ts
  const currentRoleIn = (m: Member | null, d: Department) => m?.roles.find((r) => r.department === d)?.id ?? '';
  const draftRoleName = confirmDept
    ? roles.find((r) => r.id === roleDrafts[confirmDept])?.name ?? ''
    : '';
```

Borrar `currentRoleId`, `roleDraft`/`setRoleDraft` y `confirmRole`/`setConfirmRole`.

3. En `openMember`, sustituir `setRoleDraft(m.roles[0]?.id ?? '');` por:

```ts
    setRoleDrafts(Object.fromEntries(managed.map((d) => [d, currentRoleIn(m, d)])));
```

4. `patchUser`: cambiar el tipo del parámetro `role_ids?: string[];` por `department_role?: { department: Department; role_id: string };`.

5. Sustituir `handleSaveRole`:

```ts
  const handleSaveRole = async () => {
    const roleId = confirmDept ? roleDrafts[confirmDept] : undefined;
    if (!member || !confirmDept || !roleId) return;
    setBusy('roles');
    try {
      await patchUser({ department_role: { department: confirmDept, role_id: roleId } });
      toast.success('Rol actualizado');
      mutate();
      setConfirmDept(null);
      closeMember();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol');
      setConfirmDept(null);
    } finally {
      setBusy(null);
    }
  };
```

6. Nombres: solo editables con `canRename`. Añadir `disabled={!canRename}` y `disabled:opacity-60` a la clase de los tres `<input>` (Nombre, Primer apellido, Alias), y envolver el botón «Guardar» del pie en `{canRename && ( … )}`. Motivo, para el comentario junto al pie: «Renombrar exige gestionar_roles en la API; sin él, el botón solo devolvía un error».

7. Zona avanzada: la condición pasa de `access.can('gestionar_roles')` a `managed.length > 0`, y dentro, en lugar del único `Select`, uno por departamento gestionado. Sustituir desde `<p className="text-eyebrow text-muted-foreground">Rol</p>` hasta el botón «Cambiar rol» incluido por:

```tsx
                          {managed.map((d) => {
                            const options = roles.filter((r) => r.department === d);
                            const draft = roleDrafts[d] ?? '';
                            return (
                              <div key={d} className="space-y-2">
                                <p className="text-eyebrow text-muted-foreground">
                                  {d === 'creativo' ? 'Rol en creativo' : 'Rol en Agentes'}
                                </p>
                                <Select
                                  value={draft}
                                  onValueChange={(v) => setRoleDrafts((prev) => ({ ...prev, [d]: v }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sin rol" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDept(d)}
                                  disabled={!draft || draft === currentRoleIn(member, d)}
                                  className="flex h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50 md:h-9"
                                >
                                  Cambiar rol
                                </button>
                              </div>
                            );
                          })}
```

El botón «Eliminar usuario» se queda dentro de la zona avanzada pero envuelto en `{access.can('gestionar_roles') && ( … )}`: borrar cuentas sigue siendo solo de quien gestiona roles.

8. El `ConfirmDialog` del rol: `open={confirmDept !== null}` y `onOpenChange={(o) => !o && setConfirmDept(null)}`. El resto de sus props no cambia.

9. Actualizar el comentario de cabecera del archivo: el rol se elige **por departamento**, y quien solo reparte en Agentes ve solo a la gente de Agentes y no renombra ni elimina.

10. El botón «Invitar miembro» pasa de `access.can('invitar_personal')` a `departmentsInvitableBy(access).length > 0` (añadir `departmentsInvitableBy` al import).

- [ ] **Paso 8: el diálogo de invitación**

En `components/invitations/create-invitation-dialog.tsx`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { defaultInviteRole, departmentsInvitableBy } from '@/lib/utils/access';
```

Sustituir el bloque desde `const { roles } = useRoles();` hasta el `useEffect` del rol por defecto incluido:

```ts
  const { roles: allRoles } = useRoles();
  const { access } = useAuth();
  // Solo los roles de los departamentos a los que esta cuenta puede invitar:
  // un director no invita a nadie como Gestor creativo (y la base tampoco le dejaría).
  const departments = useMemo(() => departmentsInvitableBy(access), [access]);
  const roles = useMemo(
    () => allRoles.filter((r) => departments.includes(r.department)),
    [allRoles, departments]
  );
  const [roleId, setRoleId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Por defecto, el rol de menos permisos del primer departamento: «Diseñador»
  // en creativo, «Agente» en Agentes. Sin comparar nombres.
  useEffect(() => {
    if (!roleId && roles.length) {
      setRoleId(defaultInviteRole(roles, departments)?.id ?? roles[0].id);
    }
  }, [roles, roleId, departments]);
```

El `Select` de más abajo ya recorre `roles`, que ahora es la lista filtrada: no cambia.

- [ ] **Paso 9: tipos, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Esperado: todo en verde.

- [ ] **Paso 10: commit (solo con autorización de Mario)**

```bash
git add lib/utils/access.ts lib/utils/access.test.ts components/features/account/members-panel.tsx \
  components/invitations/create-invitation-dialog.tsx app/api/users/\[id\]/route.ts \
  lib/hooks/use-users-data.ts components/layout/user-menu.tsx app/\(dashboard\)/ajustes/page.tsx
git commit -m "feat(agentes): un director invita y reparte roles solo en Agentes"
```

---

### Tarea 5: La migración 050 (escribirla, no aplicarla)

**Archivos:**
- Crear: `supabase/migrations/050_agentes_roles_y_permisos.sql`

**Interfaces:**
- Produce: roles `Agente` y `Director` (departamento `agentes`); permisos `invitar_agentes` y `gestionar_agentes` para Director; funciones `role_department(uuid) → text`, `can_manage_invitation(uuid, uuid, uuid) → boolean`, `set_department_role(uuid, text, uuid) → void`; valor `AGENTE` en `role_enum`.

- [ ] **Paso 1: comprobar el número y el estado vivo**

```bash
ls supabase/migrations | tail -3
```

Esperado: la última es `048_…`; la 049 está reservada. Comprobar en la base viva, con consultas de solo lectura (MCP de Supabase, proyecto `zhuluiqpakuwehibjyva`), que `use_invitation` y las cuatro políticas de `invitations` siguen como las deja la 046:

```sql
select policyname, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'invitations';
select pg_get_functiondef('public.use_invitation'::regproc);
```

Si `use_invitation` difiere del cuerpo copiado en el paso 2 en algo más que la rama del rol antiguo, **parar** y partir del vivo.

- [ ] **Paso 2: escribir la migración**

```sql
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
```

- [ ] **Paso 3: revisión con contexto limpio**

Pedir una revisión de la migración a un subagente de solo lectura, sin esta conversación, con el spec, este plan y las migraciones 044, 045 y 046 delante. Preguntas concretas: ¿puede un director, por PostgREST directo, dar un rol de creativo, ver invitaciones de creativo o borrar roles de creativo? ¿Cambia algo para `main`? ¿Algún `search_path` o permiso de `execute` olvidado? Los hallazgos se resuelven antes de la tarea 6.

- [ ] **Paso 4: commit (solo con autorización de Mario)**

```bash
git add supabase/migrations/050_agentes_roles_y_permisos.sql
git commit -m "feat(agentes): migración del departamento de Agentes, sin aplicar"
```

---

### Tarea 6: Aplicar la migración y comprobarla (con permiso de Mario)

**Archivos:** ninguno nuevo.

- [ ] **Paso 1: pedir permiso**

Contarle a Mario en dos frases qué añade la 050 y que solo cambia el comportamiento de invitaciones para los roles nuevos. **Esperar un sí explícito.** Sin él, la tarea se queda aquí.

- [ ] **Paso 2: aplicar**

Con el MCP de Supabase, `apply_migration` sobre `zhuluiqpakuwehibjyva`, nombre `agentes_roles_y_permisos`, con el contenido del archivo.

- [ ] **Paso 3: leer de vuelta**

```sql
select r.name, r.department, array_agg(rp.permission order by rp.permission) as perms
from public.roles r left join public.role_permissions rp on rp.role_id = r.id
group by r.id order by r.created_at;
```

Esperado: los tres de creativo como estaban, más `Agente` (`{NULL}`) y `Director` (`{gestionar_agentes,invitar_agentes}`).

```sql
select pg_get_functiondef('public.use_invitation'::regproc) like '%AGENTE%' as agente_en_alta,
       enum_range(null::public.role_enum)::text as valores;
```

Esperado: `true`, `{ADMIN,DESIGNER,JUGADOR,AGENTE}`.

- [ ] **Paso 4: sesiones simuladas (escriben dentro de una transacción que se deshace; incluido en el permiso del paso 1)**

Se presta un rol de Agentes a Loren **dentro de la transacción** y se deshace al final. Primero se leen los uuid (antes de cambiar de rol, o `auth.uid()` sale nulo):

```sql
select display_name, id from public.profiles where display_name in ('Loren', 'Mario');
select name, id from public.roles where name in ('Director', 'Agente', 'Diseñador');
```

Y se pegan en los bloques siguientes en lugar de `<LOREN>`, `<MARIO>`, `<DIRECTOR>`, `<AGENTE>` y `<DISENADOR>`. Loren como Director: no ve diseños ni invitaciones de creativo, invita a Agentes y reparte roles de Agentes:

```sql
begin;
delete from public.profile_roles where profile_id = '<LOREN>';
insert into public.profile_roles (profile_id, role_id) values ('<LOREN>', '<DIRECTOR>');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<LOREN>', 'role', 'authenticated')::text, true);
select count(*) as ve_disenos from public.designs;                                   -- 0
select count(*) filter (where public.role_department(role_id) is distinct from 'agentes') as ve_invitaciones_creativo
  from public.invitations;                                                           -- 0
insert into public.invitations (token, role_id, created_by, max_uses, expires_at)
  values ('prueba-agente', '<AGENTE>', '<LOREN>', 1, now() + interval '1 day');      -- pasa
select public.set_department_role('<MARIO>', 'agentes', '<AGENTE>');                 -- pasa
rollback;
```

Las columnas del `insert` son las de la tabla viva a 2026-10-11 (`token` y `role` obligatorias; `role` es texto con `'DESIGNER'` por defecto).

```sql
-- Lo que tiene que fallar, cada uno en su transacción (el error aborta la anterior):
begin;
delete from public.profile_roles where profile_id = '<LOREN>';
insert into public.profile_roles (profile_id, role_id) values ('<LOREN>', '<DIRECTOR>');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<LOREN>', 'role', 'authenticated')::text, true);
insert into public.invitations (token, role_id, created_by, max_uses, expires_at)
  values ('prueba-creativo', '<DISENADOR>', '<LOREN>', 1, now() + interval '1 day'); -- falla: RLS (42501)
rollback;

begin;
delete from public.profile_roles where profile_id = '<LOREN>';
insert into public.profile_roles (profile_id, role_id) values ('<LOREN>', '<DIRECTOR>');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<LOREN>', 'role', 'authenticated')::text, true);
select public.set_department_role('<MARIO>', 'creativo', '<DISENADOR>');             -- falla: RLS (42501)
rollback;
```

Foco 2 (dos departamentos) y foco 3 (invitaciones de `main`), como Mario:

```sql
begin;
insert into public.profile_roles (profile_id, role_id) values ('<LOREN>', '<AGENTE>');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<MARIO>', 'role', 'authenticated')::text, true);
select public.set_department_role('<LOREN>', 'agentes', '<DIRECTOR>');
select r.name from public.profile_roles pr join public.roles r on r.id = pr.role_id
  where pr.profile_id = '<LOREN>' order by r.name;                                   -- Director, Diseñador
insert into public.invitations (token, role, created_by, max_uses, expires_at)
  values ('prueba-main', 'DESIGNER', '<MARIO>', 1, now() + interval '1 day');        -- pasa (sin role_id = creativo)
rollback;
```

Esperado: lo marcado en cada comentario. Cualquier otro resultado: **parar** y contárselo a Mario antes de seguir.

- [ ] **Paso 5: nada se quedó escrito**

```sql
select count(*) from public.invitations where token like 'prueba-%';                -- 0
select count(*) from public.profile_roles pr join public.roles r on r.id = pr.role_id
  where r.department = 'agentes';                                                   -- 0
```

---

### Tarea 7: Verificación de la rama entera

- [ ] **Paso 1: automático**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Esperado: todo en verde. Anotar el número de tests (línea base + nuevos).

- [ ] **Paso 2: creativo no ha cambiado (con la sesión de Mario)**

Con el servidor de producción local (`npm run build && npm start -p 3100`) y la receta de Playwright del pendiente 12 de `estado-y-traspaso.md` (credenciales de `.env.local`, nunca impresas), capturar en WebKit iPhone 15 y en escritorio: `/inicio`, `/disenos`, `/ajustes?tab=miembros` (con el popup de un miembro y la zona avanzada abierta) y el diálogo de invitar.

Esperado:
- Navegación y tab bar exactamente como antes (cuatro entradas y el «+»). Mario aún no tiene rol de Agentes, así que **no** ve «Campograma».
- En la zona avanzada de un miembro, dos selectores: «Rol en creativo» con su rol actual y «Rol en Agentes» vacío.
- En invitar, aparecen los cinco roles y viene marcado «Diseñador».
- `/campograma` a mano manda a Mario a su casa.

- [ ] **Paso 3: lo que no se puede comprobar sin una cuenta de agente**

Queda para la tarea 9: la cara de agente de verdad, la tab bar con una sola entrada y si la navegación de creativo asoma un instante al cargar.

---

### Tarea 8: Documentación

**Archivos:**
- Modificar: `docs/estado-y-traspaso.md`, `.claude/rules/permisos.md`, `CLAUDE.md`

Ojo: en la carpeta principal hay cambios sin commitear de otra sesión en `estado-y-traspaso.md` y en `CLAUDE.md`. Aquí se edita la versión de la rama; al integrar en `preview` puede haber conflicto. Cambios pequeños y en sitios concretos para que sea fácil de resolver.

- [ ] **Paso 1: `estado-y-traspaso.md`**

Añadir al principio del bloque «Actualizado» una entrada del día y, en «Qué se hizo en octubre de 2026» (crear la sección si no existe, tras la de septiembre), un apartado `### 1. El departamento de Agentes (fase 1 del campograma)` con: qué hay (roles, cara, navegación, puerta por departamento, Miembros e invitaciones acotados), la migración 050 y si está aplicada, por qué un agente nace `AGENTE` en la casilla antigua, y que **no se invita a agentes reales hasta el merge**. En «Qué queda pendiente», ampliar el 11: la 049 también borra el valor `AGENTE`.

- [ ] **Paso 2: `.claude/rules/permisos.md`**

Añadir un párrafo: los permisos de Agentes van aparte de los de creativo (`invitar_agentes`, `gestionar_agentes`) porque `gestionar_roles` abre también borrar cuentas, la auditoría y los avisos; repartir roles se hace **por departamento** con `set_department_role`, nunca con `set_profile_roles`, que borra los del otro departamento; y qué ruta es de qué departamento se dice en `lib/utils/navigation.ts`.

- [ ] **Paso 3: `CLAUDE.md`**

En «Cómo está montado», la línea de `app/(dashboard)/` pasa a: `inicio · mi-semana · disenos · equipo · jugadores · campograma · ajustes · ayuda`.

- [ ] **Paso 4: commit (solo con autorización de Mario)**

```bash
git add docs/estado-y-traspaso.md .claude/rules/permisos.md CLAUDE.md
git commit -m "docs(agentes): el departamento de Agentes, su migración y lo que espera al merge"
```

---

### Tarea 9: Cuenta de prueba de agente (la hace Mario)

Crear una cuenta es cosa de Mario: con correo real y contraseña suya. Pasos para él:

1. En staging, Ajustes → Miembros → Invitar miembro, rol **Agente**. Abrir el enlace en una ventana privada y darse de alta con otro correo.
2. Comprobar, en el iPhone y en el ordenador:
   - entra directo a «Campograma», sin nada debajo;
   - la navegación solo tiene «Campograma», sin el «+»;
   - escribir `/disenos` o `/inicio` a mano le devuelve al campograma;
   - en Ayuda solo salen consejos de la cuenta;
   - al cargar, ¿asoma un instante la navegación de creativo? Si sí, se corrige antes de seguir (es el único punto que no se puede comprobar de otra forma).
3. Avisar para comprobar en la base que esa cuenta tiene `role = 'AGENTE'` (foco 5) y que no aparece entre los diseñadores de producción.

Esa cuenta se queda como la cuenta de pruebas del pendiente 2 de `estado-y-traspaso.md`.

---

## Fuera de esta fase

- La cartera, el campograma y su edición (fases 2 a 4).
- Quitarle a alguien su rol de un departamento sin darle otro.
- Ajustes → General sigue enseñando a un agente las preferencias de diseños (vista por defecto, avisos de asignación). Se ajusta en la fase 3, cuando el campograma tenga contenido.
- Para que Mario vea el campograma necesita un rol de Agentes. Se lo da otro gestor desde Miembros: nadie se cambia su propio rol.
- Los otros tres gestores creativos también podrán invitar agentes y nombrar directores (`gestionar_roles` vale para todo). Si no se quiere, es una migración de permisos aparte.
