'use client';

/**
 * Marco del futbolista — deliberadamente pelado.
 *
 * El grupo `(jugador)` existe para que estas pantallas NO carguen nada del
 * panel de la agencia: ni barra lateral, ni cabecera, ni tab bar. Es el mismo
 * recurso que ya separa `(auth)` de `(dashboard)`: cada grupo, su marco.
 *
 * Lo único que comparte con el panel es el guardián de sesión.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function JugadorLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'UNAUTHENTICATED') router.push('/login');
  }, [status, router]);

  if (status !== 'AUTHENTICATED') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
          aria-label="Cargando"
        />
      </div>
    );
  }

  return <div className="min-h-svh bg-background">{children}</div>;
}
