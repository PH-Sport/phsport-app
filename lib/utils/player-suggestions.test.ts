import { describe, it, expect } from 'vitest';
import { suggestPlayers, applySuggestion, type PortfolioName } from './player-suggestions';

// Nombres inventados: el repositorio es público y aquí no entra ningún jugador
// de verdad de la cartera.
const NAMES: PortfolioName[] = [
  { name: 'Ana Prueba', team: 'Club Uno' },
  { name: 'Juan Inventado', team: 'Club Dos' },
  { name: 'Juanjo Ejemplo', team: null },
  { name: 'Luis Jurado Demo', team: 'Club Tres' },
  { name: 'Pedro Muñoz Ficticio', team: 'Club Uno' },
  { name: 'Jean-Paul Simulado', team: 'Club Cuatro' },
];

const names = (list: PortfolioName[]) => list.map((p) => p.name);

describe('suggestPlayers', () => {
  it('con menos de dos letras no sugiere nada', () => {
    expect(suggestPlayers(NAMES, '')).toEqual([]);
    expect(suggestPlayers(NAMES, 'j')).toEqual([]);
    expect(suggestPlayers(NAMES, '  j  ')).toEqual([]);
  });

  it('busca por el principio de cualquier palabra, no por trozos sueltos', () => {
    // «an» está dentro de «Juan», pero no empieza ninguna palabra salvo «Ana».
    expect(names(suggestPlayers(NAMES, 'an'))).toEqual(['Ana Prueba']);
  });

  it('pone primero a quien empieza por lo escrito y luego al resto', () => {
    expect(names(suggestPlayers(NAMES, 'ju'))).toEqual([
      'Juan Inventado',
      'Juanjo Ejemplo',
      'Luis Jurado Demo',
    ]);
  });

  it('no distingue tildes ni mayúsculas', () => {
    expect(names(suggestPlayers(NAMES, 'MUNOZ'))).toEqual(['Pedro Muñoz Ficticio']);
    expect(names(suggestPlayers(NAMES, 'muñ'))).toEqual(['Pedro Muñoz Ficticio']);
  });

  it('con varias palabras, todas tienen que encajar', () => {
    expect(names(suggestPlayers(NAMES, 'juan inv'))).toEqual(['Juan Inventado']);
    expect(suggestPlayers(NAMES, 'juan xyz')).toEqual([]);
  });

  it('trata el guion como separador de palabras', () => {
    expect(names(suggestPlayers(NAMES, 'paul'))).toEqual(['Jean-Paul Simulado']);
  });

  it('en una lista con comas sugiere solo para el último nombre', () => {
    expect(names(suggestPlayers(NAMES, 'Ana Prueba, ped'))).toEqual(['Pedro Muñoz Ficticio']);
    expect(suggestPlayers(NAMES, 'Ana Prueba, ')).toEqual([]);
  });

  it('respeta el límite', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Jugador ${i}`, team: null }));
    expect(suggestPlayers(many, 'jug')).toHaveLength(6);
    expect(suggestPlayers(many, 'jug', 3)).toHaveLength(3);
  });

  it('devuelve el equipo con el nombre', () => {
    expect(suggestPlayers(NAMES, 'juanjo')).toEqual([{ name: 'Juanjo Ejemplo', team: null }]);
  });
});

describe('applySuggestion', () => {
  it('sustituye lo escrito por el nombre elegido', () => {
    expect(applySuggestion('jua', 'Juan Inventado')).toBe('Juan Inventado');
  });

  it('en una lista con comas sustituye solo el último nombre', () => {
    expect(applySuggestion('Ana Prueba, ped', 'Pedro Muñoz Ficticio')).toBe(
      'Ana Prueba, Pedro Muñoz Ficticio'
    );
    expect(applySuggestion('Ana Prueba,ped', 'Pedro Muñoz Ficticio')).toBe(
      'Ana Prueba, Pedro Muñoz Ficticio'
    );
  });
});
