---
paths:
  - "components/layout/**"
  - "components/ui/page-container.tsx"
  - "components/ui/page-header.tsx"
  - "app/layout.tsx"
  - "app/globals.css"
  - "app/manifest.ts"
---

# Cabecera, tab bar y la app instalada en iOS

Nada de esto se reproduce con el WebKit de escritorio de Playwright: solo en un
iPhone con iOS 26. Ante un fallo visual, mira la pantalla antes de teorizar.

**La cabecera móvil es `sticky` con margen inferior negativo, no `fixed`.**
`fixed` fue el primer intento y se portó mal en iPhone: la barra cuelga de un
`motion.div`, y un ancestro animado por framer-motion puede establecer
*containing block*, con lo que `fixed` deja de referirse al viewport. El fondo
con alpha `0.99` que lleva es una red de seguridad ante Safari 26; está
comentado, no lo «arregles».

**El fundido de la tab bar y el `pb` del contenido van acoplados.** Los dos
valen `6.5rem`: la altura del degradado en `mobile-tab-bar.tsx` y el
`pb-[calc(env(safe-area-inset-bottom)+6.5rem)]` de `page-container.tsx`. Si el
contenido termina **dentro** de la franja del degradado, la última fila se lee
atenuada al llegar al final del scroll. Cambiar uno obliga a cambiar el otro;
está comentado en ambos archivos.

**Safari 26 ya no lee `theme-color`.** Tinta su barra muestreando el fondo de
los elementos fijos o pegajosos cercanos al borde, incluso si tienen
`opacity: 0`. El `themeColor` de `app/layout.tsx` no hace nada en iOS 26. Si
aparece un tinte raro, mirar ahí. **Y si el elemento pegado no tiene fondo**
(la cabecera, transparente arriba del todo), cae al fondo de `html`; sin él,
pinta una **banda blanca** sobre la cabecera, más clara que la página, que
Mario vio el 2026-09-17 tocando el título, la campana y el avatar. Desde ese
día `html` lleva el mismo fondo que `body` (`app/globals.css`): la banda
sigue ahí, pero del color de la página.

**Y en la app instalada, iOS 26 además pinta un velo de cristal** desde la
barra de estado hacia abajo (~24 px, se desvanece) **cuando la cabecera
—el elemento pegado al borde superior— es transparente**; con cualquier
fondo, aunque sea al 2 %, usa borde duro y no hay velo. Por eso la cabecera
lleva `bg-background/[0.02]` arriba del todo (`header.tsx`): invisible, el
título se ve a través, y iOS contento. Lo que NO funcionó, para no
repetirlo: reservar 24 px de hueco (funciona pero cuesta espacio), un scroll
de 1 px al arrancar (no era la causa) y un elemento sticky de 1 px con fondo
antes de la cabecera (iOS mira a la cabecera, no a un hilo). Cómo se midió:
muestrear una captura del iPhone columna a columna (script de Node que
decodifica el PNG) y ver el color del avatar aclararse hacia arriba.
