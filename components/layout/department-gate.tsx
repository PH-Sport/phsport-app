'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor } from '@/lib/utils/access';
import { canEnterRoute } from '@/lib/utils/navigation';

/**
 * Saca de una pantalla a quien no es de su departamento y lo manda a su casa.
 * Un solo sitio para todas las rutas del panel, en vez de una guarda por
 * página: con dos departamentos, la página que se olvidara la guarda quedaba
 * abierta. La base ya impide leer los datos; esto evita enseñar la pantalla.
 *
 * Mientras la sesión resuelve, deja pasar: cada página pinta su esqueleto.
 */
export function DepartmentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { profile, access, status } = useAuth();
  const denied = status !== 'INITIALIZING' && !!profile && !canEnterRoute(pathname, access);

  useEffect(() => {
    if (denied) router.replace(homeFor(viewModeFor(profile)));
  }, [denied, profile, router]);

  if (denied) return null;
  return <>{children}</>;
}
