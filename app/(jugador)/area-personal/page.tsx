import { AreaPersonal } from '@/components/features/jugador/area-personal';

export const metadata = {
  title: 'Área personal · PHSPORT',
};

/**
 * VISTA PREVIA — sin funcionalidad y con datos inventados.
 *
 * Está en `preview` para poder mirarla desde la PWA instalada y decidir la
 * disposición antes de construir el sistema de carpetas. Se llega por el botón
 * del final de Ajustes, que solo se dibuja para cuentas de desarrollador.
 *
 * Cuando el área personal sea de verdad, esta página deja de ser una maqueta:
 * el marco y la disposición se quedan, y los datos dejan de ser de mentira.
 */
export default function AreaPersonalPage() {
  return <AreaPersonal />;
}
