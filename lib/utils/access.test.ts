import { describe, it, expect } from 'vitest';
import {
  deriveAccess,
  homeFor,
  normalizeProfile,
  roleBadgeLabel,
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
  permissions: ['invitar_jugadores', 'recibir_asignaciones'] as const,
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
            role_permissions: [{ permission: 'invitar_jugadores' }, { permission: 'recibir_asignaciones' }],
          },
        },
      ],
    };
    const p = normalizeProfile(raw);
    expect(p.roles).toEqual([disenador]);
    expect('profile_roles' in p).toBe(false);
  });

  it('sin filas anidadas deja roles vacío', () => {
    expect(normalizeProfile({ ...base, profile_roles: undefined }).roles).toEqual([]);
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
    const senior = {
      ...gestor,
      id: 'r2',
      name: 'Diseñador senior',
      permissions: ['invitar_personal', 'recibir_asignaciones'] as const,
    };
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

describe('roleBadgeLabel', () => {
  it('junta los nombres de rol, o un guion si no hay', () => {
    expect(roleBadgeLabel({ roles: [gestor, disenador] })).toBe('Gestor creativo · Diseñador');
    expect(roleBadgeLabel({ roles: [] })).toBe('—');
    expect(roleBadgeLabel(null)).toBe('—');
  });
});
