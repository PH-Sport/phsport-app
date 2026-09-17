'use client';

/**
 * MobileTabBar — navegación inferior para móvil (<md) + acción de crear.
 *
 * Patrón iOS 26 (Liquid Glass): píldora de pestañas flotante y, separado a su
 * derecha (zona del pulgar), el círculo de acción — como Apple Music (buscar),
 * Fitness o Teléfono (teclado). La píldora es glass-sidebar (el material de
 * marca) con pill dorada que se desliza entre pestañas con muelle sin rebote;
 * el círculo es el CTA primario de la app (crear diseños) en dorado reservado.
 *
 * Crear aquí es GLOBAL: abre el diálogo desde cualquier sección y revalida
 * las listas de diseños vivas vía SWR. En escritorio nada de esto existe:
 * allí mandan la sidebar y los botones de página.
 *
 * Nota PWA: hoy se muestra en cualquier viewport móvil (probable en Vercel
 * Preview). Si se prefiere solo en la app instalada, gatear con
 * `@media (display-mode: standalone)`.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';
import { SPRINGS } from '@/components/ui/animations';
import { useAuth } from '@/lib/auth/auth-context';
import { CreateDesignDialog } from '@/components/features/designs/dialogs/create-design-dialog';
import { viewModeFor } from '@/lib/utils/access';
import { buildNavItems, isItemActive } from './app-sidebar';
import { cn } from '@/lib/utils';

export function MobileTabBar() {
  const { profile } = useAuth();
  const pathname = usePathname() ?? '';
  const { mutate } = useSWRConfig();

  // Destino tocado, antes de que Next termine de navegar: la pastilla no
  // espera a la ruta. Sin esto arranca tarde y el gesto se siente perezoso.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  // El diálogo no se monta hasta el primer uso: evita cargar diseñadores
  // (useDesigners) en cada página para quien nunca toca el «+».
  const [createMounted, setCreateMounted] = useState(false);

  // Solo las 3 secciones principales: Ajustes ya vive en el dropdown del perfil.
  const items = buildNavItems(viewModeFor(profile));

  // La ruta manda en cuanto llega; hasta entonces manda el dedo.
  const activeHref =
    items.find(({ href }) => isItemActive(pathname, href))?.href ?? items[0]?.href;
  const shownHref = pendingHref ?? activeHref;
  // Posición de la pastilla, en celdas. Nunca -1: sin coincidencia, la primera.
  const activeIndex = Math.max(
    0,
    items.findIndex(({ href }) => href === shownHref)
  );

  // Cualquier cambio de ruta suelta el optimismo y devuelve el mando a la
  // realidad — tanto si llegamos al destino tocado como si acabamos en otro.
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    setPendingHref(null);
  }, [pathname]);

  const openCreate = () => {
    setCreateMounted(true);
    setCreateOpen(true);
  };

  // Crear es global: revalida cualquier lista de diseños viva (la de la página
  // actual incluida) sin depender del mutate local de cada página.
  const revalidateDesigns = () =>
    mutate(
      (key) =>
        (typeof key === 'string' && key.startsWith('/api/designs')) ||
        (Array.isArray(key) && key[0] === 'team-data')
    );

  return (
    <>
      {/* Fundido inferior — el otro extremo del scroll edge effect de la cabecera.
          La barra flota, así que el contenido le pasa por detrás y asomaba nítido
          y cortado a media altura en el hueco que queda hasta el borde. Esta capa
          lo desvanece contra el fondo antes de que llegue ahí.

          Va de opaco a transparente con la parada intermedia al 50%: la mitad de
          abajo (la que cubre la barra y el home indicator) tapa del todo, y solo
          el tramo de arriba difumina. Un degradado de dos paradas a esta altura
          se nota como una banda gris sobre el contenido.

          `background` y no `card`: es el fondo de la página lo que hay detrás.
          Como es un token, sirve igual en claro y en oscuro. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(env(safe-area-inset-bottom)+6.5rem)] bg-gradient-to-t from-background via-background to-transparent md:hidden"
      />
      <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 md:hidden">
        <nav
          aria-label="Navegación principal"
          className="glass-sidebar min-w-0 flex-1 rounded-2xl shadow-overlay"
        >
          <ul
            className="relative grid"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {/* La pastilla NO se monta y desmonta entre pestañas: es una sola,
                fuera de las celdas, que se desplaza con su propio transform.
                Con layoutId, framer guardaba su posición en coordenadas de
                documento; al navegar, el scroll volvía a 0 y la pastilla
                recorría esa diferencia — de ahí la diagonal. Un transform
                propio no depende de medida alguna, así que es inmune. */}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ x: `${activeIndex * 100}%` }}
              transition={SPRINGS.smooth}
              // El ancho sale del número real de secciones, no de un w-1/3
              // fijo: si algún día son dos o cuatro, la pastilla sigue casando.
              style={{ width: `${100 / items.length}%` }}
              className="pointer-events-none absolute inset-y-1.5 left-0 px-1.5"
            >
              <span className="block h-full w-full rounded-xl border border-primary/25 bg-primary/25 shadow-sm" />
            </motion.span>

            {items.map(({ href, label, icon: Icon }) => {
              const active = isItemActive(pathname, href);
              const shown = shownHref === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setPendingHref(href)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl outline-none transition-colors duration-200',
                      'focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
                      shown ? 'text-primary' : 'text-sidebar-foreground/70'
                    )}
                  >
                    <Icon className="relative z-10 h-5 w-5" aria-hidden />
                    <span className="relative z-10 text-[11px] font-medium">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Acción separada (trailing) — el CTA primario de la app. Misma esquina
            2xl que la píldora: pieza de la misma familia, no un círculo ajeno. */}
        <button
          type="button"
          onClick={openCreate}
          aria-label="Crear diseños"
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-overlay',
            'outline-none transition-transform duration-200 ease-out-expo active:scale-95',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </button>
      </div>

      {createMounted && (
        <CreateDesignDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onDesignCreated={revalidateDesigns}
        />
      )}
    </>
  );
}
