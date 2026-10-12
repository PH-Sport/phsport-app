'use client';

import { DashboardPage } from '@/components/ui/dashboard-page';
import { useAuth } from '@/lib/auth/auth-context';

/** Entrada del departamento de Agentes. El campograma llega en la fase 3. */
export default function CampogramaPage() {
  const { status } = useAuth();
  return (
    <DashboardPage title="Campograma" loading={status === 'INITIALIZING'} skeleton={null}>
      {null}
    </DashboardPage>
  );
}
