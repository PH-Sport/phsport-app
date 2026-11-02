/**
 * Sugerencias de jugador al crear diseños — lógica pura, sin React.
 *
 * Solo ayuda a escribir: el diseño sigue guardando el nombre como texto y no
 * se enlaza con la cartera (spec del campograma, §7). Los nombres llegan de
 * `portfolio_names()`, que ya los da filtrados a los activos.
 */

import { normalizeName } from '@/lib/services/designs/parse-message';

export interface PortfolioName {
  name: string;
  /** Club donde juega hoy: el de la cesión si está cedido. Nulo = sin confirmar. */
  team: string | null;
}

/** Con una sola letra salen media cartera: no ayuda a elegir, estorba. */
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 6;

/**
 * Parte el campo en lo ya cerrado y lo que se está escribiendo. Un diseño de
 * conjunto lleva varios nombres separados por coma, y solo el último está a
 * medias.
 */
function splitAtLastComma(value: string): { head: string; query: string } {
  const cut = value.lastIndexOf(',');
  return cut === -1
    ? { head: '', query: value }
    : { head: value.slice(0, cut + 1), query: value.slice(cut + 1) };
}

/**
 * Jugadores que encajan con lo que se está escribiendo.
 *
 * Cada palabra escrita tiene que ser el principio de alguna palabra del nombre:
 * buscar trozos sueltos haría que «an» sacase a todos los «Juan». Primero van
 * los que empiezan por lo escrito y después el resto, cada grupo en el orden
 * en que llegan (alfabético).
 */
export function suggestPlayers(
  names: readonly PortfolioName[],
  value: string,
  limit: number = MAX_SUGGESTIONS
): PortfolioName[] {
  const terms = normalizeName(splitAtLastComma(value).query).split(/\s+/).filter(Boolean);
  if (terms.join('').length < MIN_QUERY_LENGTH) return [];

  const first: PortfolioName[] = [];
  const rest: PortfolioName[] = [];
  for (const player of names) {
    // El guion separa palabras: «Jean-Paul» se encuentra por «paul».
    const words = normalizeName(player.name).split(/[\s-]+/).filter(Boolean);
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) continue;
    (words[0]?.startsWith(terms[0]) ? first : rest).push(player);
  }
  return [...first, ...rest].slice(0, limit);
}

/** El valor del campo tras elegir `name`: sustituye solo el nombre a medias. */
export function applySuggestion(value: string, name: string): string {
  const { head } = splitAtLastComma(value);
  return head ? `${head.trimEnd()} ${name}` : name;
}
