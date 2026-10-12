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
