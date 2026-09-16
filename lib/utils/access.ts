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
export function normalizeProfile<T extends RawProfileRoles>(
  raw: T
): Omit<T, 'profile_roles'> & { roles: ProfileRole[] } {
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
export function deriveAccess(
  profile: Pick<ProfileWithRoles, 'kind' | 'roles'> | null | undefined
): Access {
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

export function viewModeFor(
  profile: Pick<ProfileWithRoles, 'kind' | 'roles'> | null | undefined
): ViewMode {
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
