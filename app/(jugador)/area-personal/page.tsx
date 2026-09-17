import { AreaPersonal } from '@/components/features/jugador/area-personal';

export const metadata = {
  title: 'Área personal · PHSPORT',
};

/**
 * La casa del futbolista. Es la única página de su marco: sin panel, sin
 * barra lateral, sin tab bar (spec §1). Llega aquí al iniciar sesión, y el
 * middleware lo trae de vuelta si intenta entrar en el panel de la agencia.
 *
 * Nació como maqueta con datos inventados (septiembre de 2026) para decidir
 * la disposición desde la PWA; la disposición se quedó y los datos son reales.
 */
export default function AreaPersonalPage() {
  return <AreaPersonal />;
}
