/** Rótulo de sección derivado del primer segmento de la ruta. */
const SECTION_LABELS: Record<string, string> = {
  inicio: 'Inicio',
  equipo: 'Semana',
  'mi-semana': 'Semana',
  disenos: 'Diseños',
  ajustes: 'Ajustes',
  ayuda: 'Ayuda',
};

/**
 * Rótulo de la sección a la que pertenece `pathname`, o '' si no es ninguna.
 * Solo mira el primer segmento: /equipo/abc y /equipo son la misma sección.
 */
export function sectionLabelFor(pathname: string): string {
  const segment = pathname.split('/')[1] ?? '';
  return SECTION_LABELS[segment] ?? '';
}
