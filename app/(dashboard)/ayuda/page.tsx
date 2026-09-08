import { DashboardPage } from '@/components/ui/dashboard-page';
import { HelpContent } from '@/components/features/help/help-content';

export const metadata = {
  title: 'Ayuda · PHSPORT Dashboard',
};

/**
 * Ayuda — los mismos consejos que asoman en la interfaz, para leerlos seguidos.
 *
 * El contenido sale entero de `lib/help/tips.ts`, que es también de donde beben
 * los avisos y los «?» repartidos por la app. Esta página no tiene texto propio.
 */
export default function HelpPage() {
  return (
    <DashboardPage
      title="Ayuda"
      subtitle="Cómo se comporta la app cuando no es evidente"
      maxWidth="4xl"
      loading={false}
      skeleton={null}
    >
      <HelpContent />
    </DashboardPage>
  );
}
