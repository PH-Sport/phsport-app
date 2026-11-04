/**
 * El campograma — lógica pura, sin React.
 *
 * Las tablas de demarcaciones y la colocación vienen tal cual del campograma
 * suelto (`campograma-ph/src/app.js`): PH las dio por buenas y la colocación se
 * calibró a ojo. Las once demarcaciones son las de la migración 051.
 */

import { normalizeName } from '@/lib/services/designs/parse-message';

export const POSITIONS = ['POR', 'DFCI', 'DFCD', 'LI', 'LD', 'MC', 'MCOI', 'MCOD', 'EI', 'ED', 'DEL'] as const;
export type Position = (typeof POSITIONS)[number];

export type PositionLine = 'por' | 'def' | 'med' | 'ata';

export const POSITION_LINE: Record<Position, PositionLine> = {
  POR: 'por',
  DFCI: 'def',
  DFCD: 'def',
  LI: 'def',
  LD: 'def',
  MC: 'med',
  MCOI: 'med',
  MCOD: 'med',
  EI: 'ata',
  ED: 'ata',
  DEL: 'ata',
};

export const POSITION_LABEL: Record<Position, string> = {
  POR: 'Portero',
  DFCI: 'Central izq.',
  DFCD: 'Central der.',
  LI: 'Lateral izq.',
  LD: 'Lateral der.',
  MC: 'Mediocentro',
  MCOI: 'Mediapunta izq.',
  MCOD: 'Mediapunta der.',
  EI: 'Extremo izq.',
  ED: 'Extremo der.',
  DEL: 'Delantero',
};

export const POSITION_SHORT: Record<Position, string> = {
  POR: 'POR',
  DFCI: 'DFC-I',
  DFCD: 'DFC-D',
  LI: 'LI',
  LD: 'LD',
  MC: 'MC',
  MCOI: 'MCO-I',
  MCOD: 'MCO-D',
  EI: 'EI',
  ED: 'ED',
  DEL: 'DEL',
};

/** Del ataque a la portería: es el orden en que se lee el campo, no el alfabético. */
export const POSITION_ORDER: readonly Position[] = [
  'DEL',
  'EI',
  'ED',
  'MCOI',
  'MCOD',
  'MC',
  'LI',
  'DFCI',
  'DFCD',
  'LD',
  'POR',
];

/** Dónde va cada demarcación, en %, con el campo de pie y atacando hacia arriba. */
export const PITCH_XY: Record<Position, readonly [number, number]> = {
  DEL: [50, 13],
  EI: [19, 21],
  ED: [81, 21],
  MCOI: [22, 48],
  MCOD: [77, 48],
  MC: [50, 56],
  LI: [12, 72],
  DFCI: [37, 77],
  DFCD: [63, 77],
  LD: [88, 72],
  POR: [50, 91],
};

/**
 * El campo tumbado es el de pie girado un cuarto de vuelta: el ataque pasa de
 * arriba a la derecha y el costado izquierdo del equipo queda ARRIBA. No es una
 * elección de estilo. Colocarlo a ojo reintroduce el error de lados que traía
 * el Numbers original.
 */
export function rotate([x, y]: readonly [number, number]): [number, number] {
  return [100 - y, x];
}

export interface PortfolioPlayer {
  id: string;
  name: string;
  birthYear: number | null;
  ownerClub: string | null;
  situation: 'loaned' | 'pending' | null;
  loanedTo: string | null;
  position: Position;
  categoryId: string;
  photoUrl: string | null;
}

export interface PortfolioCategory {
  id: string;
  name: string;
  shortName: string;
  coach: string | null;
}

/** Una fila de `portfolio_players`, solo con lo que usa la pantalla. */
export interface PortfolioPlayerRow {
  id: string;
  name: string;
  birth_year: number | null;
  owner_club: string | null;
  situation: 'loaned' | 'pending' | null;
  loaned_to: string | null;
  position: Position;
  category_id: string;
  photo_url: string | null;
  deactivated_at: string | null;
}

export function toPortfolioPlayer(row: PortfolioPlayerRow): PortfolioPlayer {
  return {
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    ownerClub: row.owner_club,
    situation: row.situation,
    loanedTo: row.loaned_to,
    position: row.position,
    categoryId: row.category_id,
    photoUrl: row.photo_url,
  };
}

/** Un jugador de baja sale del campo, de la lista, de la búsqueda y de los contadores. */
export function isActiveRow(row: Pick<PortfolioPlayerRow, 'deactivated_at'>): boolean {
  return row.deactivated_at === null;
}

/** Busca en nombre, club y destino de la cesión, con o sin acentos («munoz» encuentra a Muñoz). */
export function matchesSearch(player: PortfolioPlayer, query: string): boolean {
  const q = normalizeName(query.trim());
  if (!q) return true;
  return normalizeName(`${player.name} ${player.ownerClub ?? ''} ${player.loanedTo ?? ''}`).includes(q);
}

/** Coincidencias por categoría: la búsqueda abarca toda la cartera, no solo la elegida. */
export function countByCategory(players: PortfolioPlayer[], query: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    counts[p.categoryId] = (counts[p.categoryId] ?? 0) + (matchesSearch(p, query) ? 1 : 0);
  }
  return counts;
}

export type Signal = 'loaned' | 'pending' | 'noClub';

/** Los contadores de cabecera no filtran el campo (decisión de PH): abren su lista. */
export const SIGNALS: Record<Signal, { title: string; matches: (p: PortfolioPlayer) => boolean }> = {
  loaned: { title: 'En cesión', matches: (p) => p.situation === 'loaned' },
  pending: { title: 'Pendiente de movimiento', matches: (p) => p.situation === 'pending' },
  noClub: { title: 'Sin club confirmado', matches: (p) => !p.ownerClub },
};

export function signalPlayers(players: PortfolioPlayer[], signal: Signal): PortfolioPlayer[] {
  return players.filter(SIGNALS[signal].matches);
}

export type PlayerSortKey = 'name' | 'year' | 'club' | 'position';

const SORT_VALUE: Record<PlayerSortKey, (p: PortfolioPlayer) => string | number | null> = {
  name: (p) => normalizeName(p.name),
  year: (p) => p.birthYear,
  club: (p) => (p.ownerClub ? normalizeName(p.ownerClub) : null),
  position: (p) => POSITION_ORDER.indexOf(p.position),
};

/** Lo que falta va al final en los dos sentidos: un hueco no es «el más joven» ni «el más viejo». */
export function sortPlayers(
  players: PortfolioPlayer[],
  key: PlayerSortKey,
  dir: 1 | -1
): PortfolioPlayer[] {
  const value = SORT_VALUE[key];
  return [...players].sort((x, y) => {
    const a = value(x);
    const b = value(y);
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return a < b ? -dir : a > b ? dir : 0;
  });
}

/** Un dato que falta se enseña como hueco, nunca se rellena (regla del campograma). */
const UNCONFIRMED = 'sin confirmar';

export function yearLabel(year: number | null): string {
  return year === null ? UNCONFIRMED : `'${String(year).slice(2)}`;
}

export function clubLabel(club: string | null): string {
  return club ?? UNCONFIRMED;
}

/** En la base el técnico es una sola línea: «Nombre — Equipo». */
export function splitCoach(coach: string): { name: string; team: string | null } {
  const [name, team] = coach.split('—').map((part) => part.trim());
  return { name, team: team || null };
}
