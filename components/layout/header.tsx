'use client';

import { usePathname } from 'next/navigation';
import { UserMenu } from './user-menu';
import { NotificationsDropdown } from './notifications-dropdown';
import { ViewAsPill } from './view-as-pill';
import { usePageTitleCollapsed } from './page-title-context';
import { sectionLabelFor } from '@/lib/ui/section-label';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname() ?? '';
  const sectionLabel = sectionLabelFor(pathname);
  // Móvil: la barra empieza desnuda y recoge el testigo del título grande al
  // desplazar. Escritorio: nada de esto aplica — rótulo y línea, siempre, como
  // antes de la fase 1.5. De ahí las contrapartes md: de ambas transiciones.
  const collapsed = usePageTitleCollapsed();

  return (
    <header
      className={cn(
        'z-30 border-b pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]',
        // Móvil: flota sobre el contenido en vez de reservarle 56px de alto. Con
        // el título grande a la vista, la mitad izquierda de esta barra está
        // vacía, así que ocupar esa franja salía caro donde menos sobra.
        //
        // Se consigue con sticky + margen negativo, NO con `fixed`. `fixed` fue
        // el primer intento y se portó mal en iPhone: el contenido se le colaba
        // por debajo mientras en Chrome se veía perfecto. La barra cuelga de
        // MainArea, que es un motion.div; un ancestro animado por framer-motion
        // puede establecer containing block (le basta will-change: transform), y
        // entonces `fixed` deja de referirse al viewport — con WebKit y Blink
        // resolviéndolo distinto. `sticky` no depende de eso.
        //
        // El -mb-14 se come los 56px de la fila de controles pero NO la
        // safe-area, que el propio header sigue reservando: así el contenido
        // sube hasta el borde de la barra sin meterse bajo el notch.
        'sticky top-0 -mb-14 md:mb-0',
        // Scroll edge effect: arriba del todo va desnuda del todo — sin fondo ni
        // línea — y al desplazar recoge ambos, que es lo que mantiene legible el
        // contenido cuando le pasa por debajo.
        //
        // En móvil el fondo tapa de verdad: el título grande pasa justo por detrás
        // del rótulo de sección, y con el 90% + 4px de desenfoque de antes se leía
        // el fantasma de uno bajo el otro. En md+ el título queda mucho más abajo y
        // nunca llega a cruzarse, así que allí se conserva el cristal esmerilado.
        //
        // El 0.99 NO es un descuido. Safari 26 trata una capa posicionada con
        // fondo EXACTAMENTE opaco como relleno simple y la recorta en el borde de
        // su barra flotante; por debajo de alpha 1 pasa por el compositor y se
        // pinta entera. Ya no dependemos de ello —esto es sticky, no fixed— pero
        // ese 1% de transparencia es invisible y sale gratis, así que se queda
        // como red de seguridad. https://1ar.io/updates/safari-26-liquid-glass-web/
        'transition-colors duration-200 ease-out-expo md:border-border md:bg-background/90 md:backdrop-blur-sm',
        collapsed ? 'border-border bg-background/[0.99]' : 'border-transparent bg-transparent'
      )}
    >
      {/* Móvil: 56px de alto — aire para los controles de 44px (como las apps nativas). */}
      <div className="flex h-14 items-center justify-between gap-2 px-3 md:h-12 md:gap-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {/* Móvil: sin hamburguesa — la navegación vive en la MobileTabBar inferior. */}
          <span
            aria-hidden={!collapsed}
            className={cn(
              'truncate text-eyebrow text-muted-foreground',
              'transition-all duration-200 ease-out-expo md:translate-y-0 md:opacity-100',
              collapsed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
            )}
          >
            {sectionLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* El rol ya no se anuncia aquí: no cambia, y vive en el menú de perfil
              junto al nombre y el correo. Solo queda el aviso de «Ver como». */}
          <ViewAsPill />
          {/* El tema vive ahora en el menú de perfil, no en la primera vista. */}
          <NotificationsDropdown />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
