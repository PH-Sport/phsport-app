'use client';

import { useEffect } from 'react';

/**
 * iOS 26, app instalada: al arrancar, el sistema pinta bajo la barra de
 * estado un velo de cristal que se queda puesto —la burbuja del avatar y la
 * campana se ven «borrosas» por arriba— hasta el primer desplazamiento real,
 * que lo recalcula y lo quita. Mario lo comprobó el 2026-09-21: bajar y
 * volver a subir lo elimina. Lo que lo confunde, casi seguro, es la animación
 * de entrada del contenido (sube 4 px mientras aparece): iOS samplea «hay
 * contenido moviéndose bajo la barra» y no vuelve a mirar hasta que hay scroll.
 *
 * Así que se hace por él, sin que se vea: cuando la entrada ha terminado, un
 * desplazamiento de 1 px y vuelta. Solo si la página está arriba del todo y
 * solo en iOS standalone; en el resto no hay velo y no se toca nada.
 */
export function IosEdgeNudge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const ios = CSS.supports('-webkit-touch-callout', 'none');
    if (!standalone || !ios) return;

    // La entrada del contenido dura ~300 ms (animate-page-enter) y el muelle
    // de la página algo más; con 700 ms se ha asentado todo.
    const id = window.setTimeout(() => {
      if (window.scrollY !== 0) return;
      window.scrollTo(0, 1);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }, 700);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
