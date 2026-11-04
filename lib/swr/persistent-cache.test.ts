import { describe, it, expect } from 'vitest';
import { persistableEntries } from './persistent-cache';

describe('persistableEntries', () => {
  it('la cartera no se guarda en el equipo, y el resto de la caché sí', () => {
    const map = new Map<string, unknown>([
      ['designs', [1]],
      ['portfolio', { players: [] }],
      ['portfolio-names', []],
    ]);
    expect(persistableEntries(map)).toEqual([['designs', [1]]]);
  });
});
