import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { getServerAuth } from '@/lib/auth/get-server-auth';
import { viewModeFor } from '@/lib/utils/access';

/**
 * Fallback de navegación (App Router): se muestra al instante al clicar el
 * enlace, mientras llega el RSC de /inicio. Elimina la sensación de "clic
 * muerto". Resuelve el rol en servidor (Fase 2, deduplicado vía React cache)
 * para pintar el variant correcto y NO reflowear al montar la página: admin =
 * 4 KPIs, designer = 3. Misma lógica que `inicio/page.tsx` para que casen.
 */
export default async function Loading() {
  const { profile } = await getServerAuth();
  return <DashboardSkeleton variant={viewModeFor(profile) === 'manager' ? 'admin' : 'designer'} />;
}
