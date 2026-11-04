import { describe, it, expect } from 'vitest';
import {
  clubLabel,
  countByCategory,
  isActiveRow,
  matchesSearch,
  otherCategoriesWithHits,
  PITCH_XY,
  POSITION_LABEL,
  POSITION_LINE,
  POSITION_ORDER,
  POSITION_SHORT,
  POSITIONS,
  rotate,
  signalPlayers,
  sortPlayers,
  splitCoach,
  toPortfolioPlayer,
  yearLabel,
  type PortfolioPlayer,
  type PortfolioPlayerRow,
} from './campograma';

// Jugadores inventados: el repo es público y aquí no entra ningún dato real.
const player = (over: Partial<PortfolioPlayer> = {}): PortfolioPlayer => ({
  id: over.name ?? 'p',
  name: 'Prueba Uno',
  birthYear: 2003,
  ownerClub: 'Club Alfa',
  situation: null,
  loanedTo: null,
  position: 'MC',
  categoryId: 'cat_a',
  photoUrl: null,
  ...over,
});

describe('matchesSearch', () => {
  it('encuentra sin acentos en el nombre', () => {
    expect(matchesSearch(player({ name: 'Prueba Muñoz' }), 'munoz')).toBe(true);
  });
  it('encuentra con acentos aunque el dato no los lleve', () => {
    expect(matchesSearch(player({ name: 'Prueba Munoz' }), 'Muñoz')).toBe(true);
  });
  it('encuentra en el club y en el destino de la cesión', () => {
    expect(matchesSearch(player({ ownerClub: 'Atlético Beta' }), 'atletico')).toBe(true);
    expect(matchesSearch(player({ situation: 'loaned', loanedTo: 'Cádiz Gamma' }), 'cadiz')).toBe(true);
  });
  it('una búsqueda vacía encuentra a todos, y lo que no está no se encuentra', () => {
    expect(matchesSearch(player(), '')).toBe(true);
    expect(matchesSearch(player(), '   ')).toBe(true);
    expect(matchesSearch(player(), 'zzz')).toBe(false);
  });
  it('un jugador sin club no rompe la búsqueda', () => {
    expect(matchesSearch(player({ ownerClub: null }), 'alfa')).toBe(false);
  });
});

describe('countByCategory', () => {
  const players = [
    player({ name: 'Prueba Uno', categoryId: 'cat_a' }),
    player({ name: 'Prueba Dos', categoryId: 'cat_a' }),
    player({ name: 'Otro Tres', categoryId: 'cat_b' }),
  ];
  it('cuenta por categoría sin búsqueda', () => {
    expect(countByCategory(players, '')).toEqual({ cat_a: 2, cat_b: 1 });
  });
  it('con búsqueda cuenta solo las coincidencias, y una categoría sin ninguna da 0', () => {
    expect(countByCategory(players, 'otro')).toEqual({ cat_a: 0, cat_b: 1 });
  });
});

describe('el campo', () => {
  it('las once demarcaciones tienen etiqueta, abreviatura, línea y sitio', () => {
    expect(POSITIONS).toHaveLength(11);
    expect(POSITION_ORDER).toHaveLength(11);
    for (const p of POSITIONS) {
      expect(POSITION_LABEL[p]).toBeTruthy();
      expect(POSITION_SHORT[p]).toBeTruthy();
      expect(POSITION_LINE[p]).toBeTruthy();
      expect(PITCH_XY[p]).toHaveLength(2);
      expect(POSITION_ORDER).toContain(p);
    }
  });
  it('de pie se ataca hacia arriba y el lateral izquierdo va a la izquierda', () => {
    expect(PITCH_XY.DEL[1]).toBeLessThan(PITCH_XY.POR[1]);
    expect(PITCH_XY.LI[0]).toBeLessThan(PITCH_XY.LD[0]);
  });
  it('al tumbarlo se ataca a la derecha, con el lateral izquierdo arriba y el derecho abajo', () => {
    expect(rotate(PITCH_XY.DEL)[0]).toBeGreaterThan(rotate(PITCH_XY.POR)[0]);
    expect(rotate(PITCH_XY.LI)[1]).toBeLessThan(rotate(PITCH_XY.LD)[1]);
  });
});

describe('lo que falta se ve como «sin confirmar»', () => {
  it('el año', () => {
    expect(yearLabel(null)).toBe('sin confirmar');
    expect(yearLabel(2003)).toBe("'03");
    expect(yearLabel(1994)).toBe("'94");
  });
  it('el club', () => {
    expect(clubLabel(null)).toBe('sin confirmar');
    expect(clubLabel('Club Alfa')).toBe('Club Alfa');
  });
});

describe('sortPlayers', () => {
  const a = player({ name: 'Ana', birthYear: 2001, ownerClub: 'Zeta', position: 'POR' });
  const b = player({ name: 'Ñaki', birthYear: null, ownerClub: null, position: 'DEL' });
  const c = player({ name: 'Óscar', birthYear: 2005, ownerClub: 'Ávila', position: 'MC' });
  const names = (list: PortfolioPlayer[]) => list.map((p) => p.name);

  it('por nombre, sin que el acento lo mande al final', () => {
    expect(names(sortPlayers([b, c, a], 'name', 1))).toEqual(['Ana', 'Ñaki', 'Óscar']);
    expect(names(sortPlayers([b, c, a], 'name', -1))).toEqual(['Óscar', 'Ñaki', 'Ana']);
  });
  it('por demarcación, en el orden del campo y no por orden alfabético', () => {
    expect(names(sortPlayers([a, b, c], 'position', 1))).toEqual(['Ñaki', 'Óscar', 'Ana']);
  });
  it('el año y el club vacíos van al final en los dos sentidos', () => {
    expect(names(sortPlayers([b, c, a], 'year', 1))).toEqual(['Ana', 'Óscar', 'Ñaki']);
    expect(names(sortPlayers([b, c, a], 'year', -1))).toEqual(['Óscar', 'Ana', 'Ñaki']);
    expect(names(sortPlayers([b, a, c], 'club', 1))).toEqual(['Óscar', 'Ana', 'Ñaki']);
    expect(names(sortPlayers([b, a, c], 'club', -1))).toEqual(['Ana', 'Óscar', 'Ñaki']);
  });
  it('no toca la lista que recibe', () => {
    const list = [c, a];
    sortPlayers(list, 'name', 1);
    expect(list).toEqual([c, a]);
  });
});

describe('signalPlayers', () => {
  const cedido = player({ name: 'Cedido', situation: 'loaned', loanedTo: 'Club Beta' });
  const pendiente = player({ name: 'Pendiente', situation: 'pending' });
  const sinClub = player({ name: 'Sin Club', ownerClub: null });
  const normal = player({ name: 'Normal' });
  const todos = [cedido, pendiente, sinClub, normal];

  it('cada contador se queda con los suyos', () => {
    expect(signalPlayers(todos, 'loaned')).toEqual([cedido]);
    expect(signalPlayers(todos, 'pending')).toEqual([pendiente]);
    expect(signalPlayers(todos, 'noClub')).toEqual([sinClub]);
  });
});

describe('splitCoach', () => {
  it('parte nombre y equipo por la raya', () => {
    expect(splitCoach('Técnico Inventado — Equipo Alfa')).toEqual({
      name: 'Técnico Inventado',
      team: 'Equipo Alfa',
    });
  });
  it('sin raya no hay equipo', () => {
    expect(splitCoach('Técnico Inventado')).toEqual({ name: 'Técnico Inventado', team: null });
  });
});

describe('las filas de la base', () => {
  const row: PortfolioPlayerRow = {
    id: 'id-1',
    name: 'Prueba Uno',
    birth_year: 2003,
    owner_club: 'Club Alfa',
    situation: 'loaned',
    loaned_to: 'Club Beta',
    position: 'MC',
    category_id: 'cat_a',
    photo_url: null,
    deactivated_at: null,
  };

  it('toPortfolioPlayer traduce la fila', () => {
    expect(toPortfolioPlayer(row)).toEqual({
      id: 'id-1',
      name: 'Prueba Uno',
      birthYear: 2003,
      ownerClub: 'Club Alfa',
      situation: 'loaned',
      loanedTo: 'Club Beta',
      position: 'MC',
      categoryId: 'cat_a',
      photoUrl: null,
    });
  });

  it('un jugador de baja no está activo, y uno recuperado sí', () => {
    expect(isActiveRow(row)).toBe(true);
    expect(isActiveRow({ ...row, deactivated_at: '2026-11-04T10:00:00Z' })).toBe(false);
  });
});

describe('otherCategoriesWithHits', () => {
  const categories = ['cat_a', 'cat_b', 'cat_c'].map((id) => ({ id, name: id, shortName: id, coach: null }));

  it('se queda con las demás categorías que tienen coincidencias, sin la elegida', () => {
    const others = otherCategoriesWithHits(categories, { cat_a: 1, cat_b: 3, cat_c: 0 }, 'cat_a');
    expect(others.map((c) => c.id)).toEqual(['cat_b']);
  });
  it('sin coincidencias fuera no hay nada que ofrecer', () => {
    expect(otherCategoriesWithHits(categories, { cat_a: 2 }, 'cat_a')).toEqual([]);
  });
});
