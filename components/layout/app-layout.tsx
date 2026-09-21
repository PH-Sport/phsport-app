'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SPRINGS } from '@/components/ui/animations';
import { useAuth } from '@/lib/auth/auth-context';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { AppSidebar, SidebarProvider, useSidebar } from './app-sidebar';
import { MobileTabBar } from './mobile-tab-bar';
import { PageTitleProvider } from './page-title-context';
import { Header } from './header';
import { IosEdgeSentinel } from './ios-edge-sentinel';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();

  // Un futbolista no pisa el panel de la agencia: su marco es (jugador). El
  // middleware ya lo desvía en servidor; esto cubre la navegación en cliente.
  const isPlayer = profile?.kind === 'JUGADOR';

  useEffect(() => {
    if (status === 'UNAUTHENTICATED') router.push('/login');
    else if (status === 'AUTHENTICATED' && isPlayer) router.replace('/area-personal');
  }, [status, isPlayer, router]);

  if (status !== 'AUTHENTICATED' || isPlayer) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
          aria-label="Cargando"
        />
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Abarca Header y contenido: el <h1> de la página publica aquí si ha
          pasado bajo la barra, y el Header lo lee. */}
      <PageTitleProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Saltar al contenido principal
        </a>
        <AppSidebar />
        {/* El shell se renderiza en SSR; el contenido de datos (SWR persistido,
            solo-cliente) se difiere a la hidratación para evitar mismatches. */}
        <MainArea>{hydrated ? children : null}</MainArea>
        {/* Navegación móvil: tab bar inferior flotante (en escritorio no existe). */}
        <MobileTabBar />
      </PageTitleProvider>
    </SidebarProvider>
  );
}

function MainArea({ children }: { children: React.ReactNode }) {
  const { contentPadLeft } = useSidebar();
  return (
    <motion.div
      initial={false}
      animate={{ paddingLeft: contentPadLeft }}
      transition={SPRINGS.smooth}
      className="min-h-svh"
    >
      {/* Antes que la cabecera: le da a iOS 26 un fondo que leer en el borde. */}
      <IosEdgeSentinel />
      <Header />
      <main id="main-content" className="animate-page-enter">
        {children}
      </main>
    </motion.div>
  );
}
