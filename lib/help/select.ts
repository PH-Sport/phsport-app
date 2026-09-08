/**
 * Selección y búsqueda de consejos — lógica pura, sin React.
 *
 * Vive aparte del catálogo (`tips.ts`) para poder probarse suelta: aquí está
 * todo lo que decide QUÉ se ve, y en el catálogo solo el texto.
 */

import {
  HELP_SECTIONS,
  HELP_TIPS,
  type HelpSection,
  type HelpSectionMeta,
  type HelpTip,
} from './tips';

/** Rol efectivo del usuario. `undefined` mientras la sesión resuelve. */
export type HelpRole = 'ADMIN' | 'DESIGNER' | undefined;

/**
 * Consejos que le sirven a un rol.
 *
 * Sin rol resuelto solo pasan los de audiencia 'todos': es preferible enseñar
 * de menos un instante que enseñarle a un diseñador, de refilón, un consejo de
 * mánager mientras la sesión termina de cargar.
 */
export function tipsForRole(role: HelpRole, tips: readonly HelpTip[] = HELP_TIPS): HelpTip[] {
  return tips.filter((tip) => tip.audience === 'todos' || tip.audience === role);
}

/** Consejo por su id, o undefined si ese id no existe en el catálogo. */
export function findTip(id: string, tips: readonly HelpTip[] = HELP_TIPS): HelpTip | undefined {
  return tips.find((tip) => tip.id === id);
}

export interface HelpGroup extends HelpSectionMeta {
  tips: HelpTip[];
}

/**
 * Agrupa por sección respetando el orden de `HELP_SECTIONS`.
 *
 * Las secciones que se quedan sin consejos NO salen: filtrar por rol puede
 * vaciar una entera, y una sección con el rótulo puesto y nada debajo parece
 * un fallo de carga.
 */
export function groupTipsBySection(
  tips: readonly HelpTip[],
  sections: readonly HelpSectionMeta[] = HELP_SECTIONS
): HelpGroup[] {
  const bySection = new Map<HelpSection, HelpTip[]>();
  for (const tip of tips) {
    const bucket = bySection.get(tip.section);
    if (bucket) bucket.push(tip);
    else bySection.set(tip.section, [tip]);
  }

  return sections
    .map((section) => ({ ...section, tips: bySection.get(section.id) ?? [] }))
    .filter((group) => group.tips.length > 0);
}

/**
 * Forma comparable de un texto: sin mayúsculas y sin tildes.
 *
 * La descomposición NFD separa la tilde de su letra y luego se tira la marca,
 * así que «diseño» y «diseno» acaban iguales. Buscar «entrega» y no encontrar
 * «entregó» sería absurdo en una ayuda escrita en castellano.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra por texto libre sobre título, cuerpo y palabras clave.
 *
 * Cada palabra de la consulta tiene que aparecer en alguna parte (Y, no O):
 * con dos términos se espera acotar, no ampliar. Consulta vacía → todo,
 * que es lo que la página quiere pintar cuando el campo está en blanco.
 */
export function searchTips(tips: readonly HelpTip[], query: string): HelpTip[] {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...tips];

  return tips.filter((tip) => {
    const haystack = normalizeForSearch(
      [tip.title, tip.body, ...(tip.keywords ?? [])].join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  });
}

// ─── Persistencia de descartes ────────────────────────────────
// El QUÉ se guarda se decide aquí (puro y probado); el DÓNDE —localStorage—
// lo pone `use-dismissed-tips`. Así el formato se prueba sin navegador.

/**
 * Lee la lista de ids descartados de su forma serializada.
 *
 * Devuelve [] ante cualquier cosa que no sea un array de textos: un valor
 * corrupto en localStorage no puede tumbar la página, y el peor efecto de
 * ignorarlo es que un aviso ya descartado vuelva a salir una vez.
 */
export function parseDismissedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((v): v is string => typeof v === 'string'))];
  } catch {
    return [];
  }
}

/** Forma serializada de la lista de descartados. */
export function serializeDismissedIds(ids: Iterable<string>): string {
  return JSON.stringify([...new Set(ids)]);
}
