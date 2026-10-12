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
