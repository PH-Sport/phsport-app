'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor, type Department } from '@/lib/utils/access';

/**
 * Guarda de página: quien no sea del departamento se va a su casa. Es el
 * patrón de `equipo/page.tsx` (useEffect + replace + render nulo), sacado a
 * un hook porque las cuatro pantallas de Jugadores lo repetían igual.
 *
 * `allowed` dice si puede quedarse; `authLoading` si aún no se sabe. Mientras
 * se sabe, la página enseña su esqueleto; si no puede, no pinta nada (la
 * redirección ya está en marcha).
 */
export function useRequireDepartment(department: Department) {
  const router = useRouter();
  const { profile, access, status } = useAuth();
  const authLoading = status === 'INITIALIZING';
  const allowed = access.inDepartment(department);
  const denied = !authLoading && !!profile && !allowed;

  useEffect(() => {
    if (denied) router.replace(homeFor(viewModeFor(profile)));
  }, [denied, profile, router]);

  return { allowed, authLoading, denied };
}
