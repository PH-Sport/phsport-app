/**
 * Un hilo de 1 px, del color de la página, pegado al borde superior.
 *
 * iOS 26 (Safari y app instalada) decide cómo pinta su barra mirando los
 * elementos `fixed`/`sticky` que tocan el borde y leyendo su `background-color`:
 * con cualquier fondo —hasta uno al 30 %— usa borde duro; si el que encuentra
 * es transparente, aplica un velo de cristal que baja ~24 px sobre el
 * contenido y lo desenfoca (la burbuja del avatar y la campana se veían
 * «borrosas» por arriba; al desplazar, la cabecera se vuelve opaca y el velo
 * desaparecía — Mario, 2026-09-21). Ver
 * https://1ar.io/updates/safari-26-liquid-glass-web/
 *
 * La cabecera es transparente arriba del todo a propósito (el título grande
 * se ve a través), así que no puede ser ella quien dé el color. Lo da esto:
 * un elemento sticky de 1 px con el fondo de la página, que no tapa nada, no
 * ocupa sitio (-mb-px) y no recibe toques. Va ANTES de la cabecera en el DOM.
 */
export function IosEdgeSentinel() {
  return <div aria-hidden className="pointer-events-none sticky top-0 z-30 -mb-px h-px bg-background" />;
}
