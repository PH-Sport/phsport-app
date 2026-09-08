# Sistema de consejos en la interfaz + sección de Ayuda

**Fecha:** 2026-09-08
**Alcance:** un catálogo de consejos, dos formas de enseñarlos dentro de la app y una ruta `/ayuda`.
**Objetivo:** que lo que la app hace por debajo —y que la pantalla no puede decir sola— deje de
descubrirse a base de sustos.

---

## Problema

La app tiene comportamientos correctos que, sin saberlos, llevan a conclusiones falsas. El caso
fundacional está en `docs/estado-y-traspaso.md` §1: «Izan reasignó tres diseños a Lluís y a Lluís no
le salen». La reasignación nunca estuvo rota — los diseños entregaban el lunes siguiente y **ninguna
vista por defecto llega tan lejos**. El trabajo estaba bien asignado y era invisible.

Ese patrón se repite en más sitios: el reparto pondera por peso y no por número de piezas, el
buscador de Diseños filtra solo sobre lo ya cargado, el push se activa por dispositivo y no por
cuenta. Nada de eso es un fallo, y nada de eso se deduce mirando.

---

## Decisiones tomadas

**1. Un solo catálogo, dos caras.** Todo el texto vive en `lib/help/tips.ts`. De ahí beben el aviso
que sale en la interfaz, el «?» y la página `/ayuda`. Si el texto viviera en el sitio donde se usa,
en tres meses el consejo de la pantalla y el de la ayuda dirían cosas distintas.

**2. Los avisos aparecen donde duele, no al entrar.** Un aviso que sale siempre deja de leerse a la
segunda vez. El `<Tip>` se coloca en la situación que confunde —una lista que sale vacía, una semana
sin nada— porque ahí el usuario ya tiene la pregunta hecha.

**3. Los descartes se guardan en `localStorage`, no en la base.** Precedente de la casa:
`defaultView` funciona igual. No hay entorno de pruebas separado —la base de desarrollo **es** la de
producción— y el historial de migraciones ya está divergido. Lo peor que provoca es que un aviso ya
visto reaparezca una vez al entrar desde otro aparato; eso no valía una migración sobre la base real.

**4. El «?» es popover, no tooltip.** Un tooltip necesita puntero y esta app se usa sobre todo desde
el móvil. `Hint` se queda para lo que ya cubría en escritorio.

**5. Ayuda entra por el pie de la barra lateral y por el menú de perfil**, el mismo trato que ya
recibe Ajustes. Fuera de la tab bar móvil: son tres pestañas de trabajo diario y esto se consulta de
uvas a peras.

**6. En `/ayuda` el texto va siempre a la vista, sin plegar.** La pantalla existe para leerlos del
tirón; esconder cada uno tras un clic la convertiría en un índice.

---

## Arquitectura

### 1. Catálogo — `lib/help/tips.ts`

`HELP_SECTIONS` (orden de lectura) y `HELP_TIPS`. Cada consejo:

| Campo | Para qué |
|---|---|
| `id` | Ancla de `/ayuda#<id>` **y** clave de descarte. Es una URL pública: no se renombra. |
| `title` | Afirmación corta que se entiende suelta. |
| `body` | Una a tres frases. Explica el porqué, no el qué. |
| `section` | Agrupación en `/ayuda`. |
| `audience` | `'todos' \| 'ADMIN' \| 'DESIGNER'`. |
| `keywords` | Términos de búsqueda que no están en el texto. |

**Criterio de admisión, para que esto no se llene de relleno:** entra si explica algo que la interfaz
no puede decir por sí sola y que, sin saberlo, lleva a una conclusión equivocada. «Pulsa el botón
para abrir el diálogo» no entra; «el buscador no mira fuera de la semana elegida» sí, porque quien no
lo sabe concluye que el diseño no existe.

### 2. Lógica pura — `lib/help/select.ts`

`tipsForRole`, `findTip`, `groupTipsBySection`, `searchTips`, `normalizeForSearch`,
`parseDismissedIds`, `serializeDismissedIds`. Sin React, con tests en `select.test.ts` (20).

Dos detalles que no son obvios:

- **Sin rol resuelto solo pasan los de audiencia `'todos'`.** Es preferible enseñar de menos un
  instante que enseñarle a un diseñador, de refilón, un consejo de mánager mientras la sesión carga.
- **La búsqueda descompone en NFD y tira las marcas diacríticas**, así que «diseño» y «diseno»
  empatan. Buscar «entrega» y no encontrar «entregó» sería absurdo en una ayuda en castellano.
- `parseDismissedIds` devuelve `[]` ante cualquier basura. Un valor corrupto en `localStorage` no
  puede tumbar la página.

### 3. Persistencia — `lib/help/use-dismissed-tips.ts`

Clave `phsport:help:dismissed`, un array de ids en JSON. Copia en memoria a nivel de módulo con
suscriptores: sin ella, el aviso de una página y el botón de restaurar de `/ayuda` tendrían cada uno
su idea de lo que está descartado.

Expone `ready`, que arranca en `false` hasta haber leído el almacenamiento. **Ningún aviso se pinta
antes de eso**: pintarlo y retirarlo un fotograma después sería un parpadeo justo donde se pide calma.

### 4. Componentes

- **`components/ui/tip.tsx`** — el aviso contextual. Hairline `border-primary/20` y fondo del acento
  al 5 %: ni caja de error ni de peligro, porque no avisa de que algo va mal. Entra y sale con
  `<Collapse>`, que es el token único de plegado de la app. Se descarta con la equis.
- **`components/ui/help-hint.tsx`** — el «?». Icono de 16 px con área tocable de 32 gracias al
  padding; el margen negativo es **solo vertical**, para no engordar la fila pero conservar el hueco
  horizontal. Un `tipId` huérfano devuelve `null`: un consejo no vale una pantalla rota.

### 5. Dónde se colocan

| Sitio | Qué sale | Por qué ahí |
|---|---|---|
| `/disenos`, lista vacía | `rango-de-fechas`, o `buscador-alcance` si hay búsqueda | Es la confusión número uno y este es el momento exacto en que ocurre |
| `/mi-semana`, semana despejada | `rango-de-fechas` | «Nada asignado» y «asignado más allá del horizonte» se ven igual |
| Taller, junto al rótulo «Tipo» | «?» de `peso-por-tipo` | El desplegable ya enseña un número por tipo; aquí se explica qué decide |
| `/equipo`, junto a «Sobrecarga» | «?» de `carga-capacidad` | Es el término que levanta la pregunta; el `4/8` se lee solo |

**Por qué no hay «?» en cada placa de `/equipo`:** serían cuatro interrogaciones repitiendo lo mismo.

### 6. Ruta — `app/(dashboard)/ayuda/`

`page.tsx` (servidor, solo la cabecera) + `components/features/help/help-content.tsx` (cliente:
búsqueda, agrupación, anclas). `loading.tsx` con `HelpSkeleton`, como Ajustes.

Los enlaces `/ayuda#<id>` que deja el «?» se resuelven en un efecto: el navegador no salta solo
cuando el ancla se pinta después de montar. Se marca el destino con un anillo durante 2,6 s — caer en
mitad de una lista larga sin marca no dice cuál era.

**`/ayuda` se añadió al `matcher` de `middleware.ts`.** Ese matcher enumera rutas una a una; sin
entrada propia, la ruta se habría quedado fuera del guardián de sesión.

---

## Fuera de alcance

- Tour guiado al primer acceso: para un equipo que ya usa la app a diario es un estorbo que se salta.
- Descartes sincronizados entre dispositivos (ver decisión 3).
- Ayuda para las pantallas de autenticación: viven fuera del shell del dashboard.

---

## Verificación

`npx tsc --noEmit`, `npm run lint`, `npm test` (165, de los cuales 20 nuevos) y `npm run build`, todo
en verde. `npm run e2e`: 12 pasan y 37 se saltan por no haber credenciales de sesión en este equipo.

**Lo que NO está comprobado:** el aspecto de `/ayuda`, del aviso y del «?» en pantalla. Sin
`PLAYWRIGHT_USER`/`PLAYWRIGHT_PASS` no se puede entrar a la app desde aquí, así que no se han visto.
