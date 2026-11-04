# Campograma, fase 3: solo consulta. Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:executing-plans (recomendado aquí) o superpowers:subagent-driven-development para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Estado:** hecho el 2026-11-04. Lo que se hizo y lo que no se comprobó, en el §4 de noviembre del estado.

**Objetivo:** que la pantalla `/campograma` enseñe la cartera real: campo, lista, panel con ficha, búsqueda, contadores y entrenadores. Sin editar nada.

**Arquitectura:** la lógica va en funciones puras en `lib/utils/campograma.ts`, con sus pruebas. Un hook SWR lee `portfolio_players` y `portfolio_categories`. Los componentes viven en `components/features/campograma/` y la página solo los junta. No hay migración: la lectura ya está permitida por las políticas de la 051 y la 053.

**Tecnología:** Next.js 15, Tailwind 3.4, SWR, los componentes propios de `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-10-11-campograma-en-la-app-design.md` (§3 y §4). Referencia de comportamiento, solo lectura: `/Users/rodz/Developer/campograma-ph/src/app.js` y `styles.css`, y las trampas de `docs/work/active/handoff-2026-09-03.md` de ese repo.

## Restricciones globales

- **El repositorio es público: ningún dato de un jugador entra en un archivo versionado.** Ni en pruebas, ni en comentarios, ni en este plan. Las pruebas usan nombres inventados. El handoff del campograma suelto lleva nombres reales: no se copian.
- **La base de datos es la de producción.** Esta fase solo lee. No se escribe nada.
- Interfaz y comentarios en castellano; identificadores en inglés. Los comentarios explican por qué.
- Sin dependencias nuevas, sin CSS modules y sin el plugin de container queries: colores por tokens en `app/globals.css` (triples HSL, en claro y en oscuro) y su entrada en `tailwind.config.ts`, igual que `role-designer`.
- Las demarcaciones son las once fijas de la 051: `POR DFCI DFCD LI LD MC MCOI MCOD EI ED DEL`.
- Situación en la base: `loaned` y `pending`. Sin club = `owner_club` nulo.
- La colocación del campo no se retoca a ojo: `PITCH_XY` se copia tal cual de `XY` en `app.js`, y la vista tumbada sale de ella con `rotate()`, igual que `gira()`.
- Tras cada tarea: `npx tsc --noEmit`, `npm run lint`, `npm test`. `npm run build` al final de cada fase de pantalla. Si `tsc` se queja de `.next/types`, son restos del build anterior (§2 de noviembre del estado).
- El pintado se mide sobre `npm run build && npm start`, nunca sobre `npm run dev`.
- Solo se añaden rutas explícitas al commit, en la rama `preview`. Nunca `git add -A`: `PENDIENTE-MAC.md` no es de este trabajo.

## Foco de la revisión

Lo que el spec implica y es más probable que falle a quien use esto. Cada línea tiene su prueba en la tarea que indica:

1. Buscar «munoz» encuentra «Muñoz», también en el club y en el destino de la cesión (tarea 1).
2. Una búsqueda sin coincidencias en la categoría activa ofrece saltar a las que sí tienen (tarea 1, y a ojo en la tarea 5).
3. Un jugador sin año o sin club sale como «sin confirmar», sin `'null`, `NaN` ni huecos (tarea 1).
4. La vista tumbada conserva los lados: LI arriba y LD abajo (tarea 1).
5. Un jugador de baja no aparece en ningún sitio, ni en los contadores ni en la búsqueda (tarea 2).

---

### Task 1: la lógica pura del campograma

**Archivos:**
- Crear: `lib/utils/campograma.ts`
- Crear: `lib/utils/campograma.test.ts`

**Interfaces que produce:**
- `POSITIONS`, `Position`, `POSITION_LABEL`, `POSITION_SHORT`, `POSITION_LINE: Record<Position, 'por' | 'def' | 'med' | 'ata'>`, `POSITION_ORDER` (los mismos valores que `F`, `LBL`, `SHORT` y `ORDER` en `app.js`).
- `PITCH_XY: Record<Position, [number, number]>` (copia de `XY`) y `rotate([x, y]) => [100 - y, x]`.
- `interface PortfolioPlayer { id; name; birthYear: number | null; ownerClub: string | null; situation: 'loaned' | 'pending' | null; loanedTo: string | null; position: Position; categoryId: string; photoUrl: string | null }`
- `interface PortfolioCategory { id; name; shortName; coach: string | null }`
- `matchesSearch(player, query): boolean`, que busca en nombre, club y destino de la cesión con `normalizeName` de `lib/services/designs/parse-message.ts`.
- `countByCategory(players, query): Record<string, number>`.
- `SIGNALS` y `signalPlayers(players, 'loaned' | 'pending' | 'noClub')`.
- `sortPlayers(players, key: 'name' | 'year' | 'club' | 'position', dir: 1 | -1)`: los valores vacíos van al final en los dos sentidos.
- `yearLabel(year): string` (`'03` o `sin confirmar`) y `clubLabel(club): string`.
- `splitCoach(coach): { name: string; team: string | null }`, que parte por `—`.

- [x] **Paso 1: escribir las pruebas que fallan.** Con jugadores inventados:
  - `matchesSearch` encuentra «munoz» en un jugador inventado llamado «Prueba Muñoz», en un club y en el destino de la cesión. Una consulta vacía encuentra a todos.
  - `countByCategory` cuenta por categoría con y sin búsqueda, y da 0 en la que no tiene coincidencias.
  - `rotate(PITCH_XY.LI)` queda por encima de `rotate(PITCH_XY.LD)` (y menor) y `rotate(PITCH_XY.DEL)` a la derecha de `rotate(PITCH_XY.POR)` (x mayor).
  - Las once demarcaciones tienen etiqueta, sitio y línea.
  - `yearLabel(null)` y `clubLabel(null)` dan «sin confirmar»; `yearLabel(2003)` da `'03`.
  - `sortPlayers` ordena por demarcación según `POSITION_ORDER`, y el año nulo va al final en ascendente y en descendente.
  - `splitCoach` sin `—` da `team: null`.
  - `signalPlayers(…, 'noClub')` solo devuelve a quien no tiene club.

- [x] **Paso 2: ejecutarlas y verlas fallar.** `npx vitest run lib/utils/campograma.test.ts`. Esperado: fallan porque el módulo no existe.

- [x] **Paso 3: implementar el módulo.** Sin React.

- [x] **Paso 4: ejecutarlas y verlas pasar.** Esperado: todas en verde, más tipos y lint.

- [x] **Paso 5: commit.** `feat(campograma): la lógica del campo, la búsqueda y los contadores`.

---

### Task 2: leer la cartera

**Archivos:**
- Crear: `lib/hooks/use-portfolio.ts`
- Modificar: `lib/utils/campograma.ts` y su prueba (`toPortfolioPlayer`)

**Interfaces:**
- Consume: los tipos de la tarea 1.
- Produce: `usePortfolio(): { players: PortfolioPlayer[]; categories: PortfolioCategory[]; isLoading: boolean; error: unknown; retry: () => void }`.

- [x] **Paso 1: prueba que falla de `toPortfolioPlayer(row)`.** Traduce la fila de la base a `PortfolioPlayer`, y `isActiveRow(row)` descarta las filas con `deactivated_at`.

- [x] **Paso 2: implementarla y verla pasar.**

- [x] **Paso 3: el hook.** Una sola clave SWR, `'portfolio'`, con `Promise.all` de las dos consultas (`.is('deactivated_at', null)` y `.order('name')`; categorías por `sort_order`). Además del filtro de la consulta, pasa cada fila por `isActiveRow`, para que un jugador de baja nunca llegue a la pantalla. Patrón: `lib/hooks/use-portfolio-names.ts`.

- [x] **Paso 4: comprobar.** Tipos, lint y pruebas. Commit `feat(campograma): la pantalla lee la cartera de la base`.

---

### Task 3: el campo

**Archivos:**
- Modificar: `app/globals.css`, `tailwind.config.ts` (tokens del césped, de las líneas del campo y de la situación)
- Crear: `components/features/campograma/pitch.tsx`
- Crear: `components/skeletons/campograma-skeleton.tsx`
- Modificar: `app/(dashboard)/campograma/page.tsx`

**Decisiones ya tomadas:**
- **Orientación:** de pie por debajo de `lg` y tumbado desde `lg` (1024 px), con clases de Tailwind sobre variables CSS (`left-[var(--x)] lg:left-[var(--xh)]`). El corte del suelto (820 px) no sirve: allí el campo llega a ocupar el 60 % de la ventana y aquí vive en la columna de contenido, junto a la barra lateral.
- **Tamaño:** de pie, ancho máximo 620 px y proporción 3/4. Tumbado, proporción 3/2 con el ancho sacado de `100dvh - 300px`, para que el delantero no se salga en un portátil.
- **El SVG lleva `preserveAspectRatio="none"` a propósito:** el círculo central es una elipse. Comentarlo, o alguien lo «arreglará».
- **Discos:** sin rótulo debajo. El nombre largo va en `title` y `aria-label`, con su contador. Vacío: borde discontinuo, sin contador. Con búsqueda: apagado si no coincide nadie.
- **Colores por línea (portero, defensa, medio, ataque):** se conservan como dato, con tokens propios en claro y en oscuro.

- [x] **Paso 1: tokens en `globals.css` y `tailwind.config.ts`.**
- [x] **Paso 2: `Pitch({ players, query, onOpenPosition })`.** Once botones colocados con `PITCH_XY` y `rotate`.
- [x] **Paso 3: la página.** `DashboardPage` con el esqueleto, `ErrorState` con reintento y `EmptyState` si no hay cartera. Muestra la primera categoría.
- [x] **Paso 4: comprobar en pantalla.** `npm run build` y servidor `phsport-prod`; guion de Playwright en el scratchpad con `e2e/.sesion/usuario.json`, en iPhone 15, iPad Mini y Desktop Chrome. Esperado: once discos dentro del campo, sin solaparse (medir cajas), de pie en iPhone y tumbado en escritorio, con LI arriba y LD abajo. **Las capturas no se versionan: llevan datos reales.**
- [x] **Paso 5: commit.** `feat(campograma): el campo con las once demarcaciones`.

---

### Task 4: el panel y la ficha

**Archivos:**
- Crear: `components/features/campograma/detail-panel.tsx`
- Modificar: `app/(dashboard)/campograma/page.tsx`

**Decisiones ya tomadas:**
- **Se usa `Dialog` con `DialogContent mobileSheet`,** la misma pieza de Notificaciones. En móvil es la hoja inferior con su arrastre; no se porta el arrastre a mano del suelto. En escritorio, el spec pide panel lateral: `Sheet` con `side="right"`, según `useIsMobile()`.
- **Estado del panel:** un valor con forma `{ kind: 'position' | 'signal' | 'player' | 'coach', … }`, con `back` para volver de la ficha a la lista de la que vino.
- **La hoja mide siempre lo mismo en móvil** (`h-[60dvh]`), para que cerrar y volver caigan siempre en el mismo sitio, como en el suelto.
- **La ficha** enseña foto (si hay), demarcación, año, club propietario, categoría y la nota de cesión con su destino, o de movimiento pendiente.

- [x] **Paso 1: implementar** lista de demarcación, ficha, volver y cerrar. Conectarlo a los discos.
- [x] **Paso 2: comprobar en pantalla** en iPhone 15 y escritorio: abrir un disco, entrar en un jugador, volver, cerrar. Con la hoja abierta el fondo no se mueve. Sin errores de consola.
- [x] **Paso 3: commit.** `feat(campograma): la lista de cada puesto y la ficha del jugador`.

---

### Task 5: categorías, búsqueda y contadores

**Archivos:**
- Crear: `components/features/campograma/toolbar.tsx`
- Modificar: `app/(dashboard)/campograma/page.tsx`, `pitch.tsx`

**Decisiones ya tomadas:**
- **Categoría:** `Tabs` con `TabsTriggerSliding` en escritorio, y `<select>` nativo en móvil, que abre la rueda del sistema y evita inventarse la accesibilidad (razón del suelto). Cada opción lleva su número.
- **Búsqueda:** sobre toda la cartera. En móvil se abre desde una lupa. La barra no envuelve (`flex-nowrap`): mientras podía, a mitad de transición Campo/Lista bajaba de línea y se veían tirones.
- **La búsqueda no dispara el fundido.** Repinta en cada tecla y sería un parpadeo.
- **Contadores:** Jugadores, En cesión, Pte. mov. y Sin club, de la categoría activa. Pulsarlos abre el panel con esa lista; a cero quedan desactivados.

- [x] **Paso 1: implementar.** Sin coincidencias en la activa: aviso con botones hacia las categorías que sí tienen, cada una con su número.
- [x] **Paso 2: comprobar en pantalla.** Buscar una palabra sin tilde con coincidencias en otra categoría: el aviso ofrece saltar y el salto funciona. En un iPhone de 375 de ancho la barra no se desborda.
- [x] **Paso 3: commit.** `feat(campograma): categorías, búsqueda en toda la cartera y contadores`.

---

### Task 6: la lista y los entrenadores

**Archivos:**
- Crear: `components/features/campograma/player-list.tsx`, `coaches.tsx`
- Modificar: `app/(dashboard)/campograma/page.tsx`, `toolbar.tsx`

**Decisiones ya tomadas:**
- **Vista Lista:** tabla ordenable por jugador, año, club y demarcación, con la columna de situación. En móvil, filas de dos líneas con `Row`, sin tabla ancha.
- **Entrenadores:** apartado propio al final, plegable, con los técnicos de todas las categorías (`Collapse`). Fuera del campo: el entrenador no ocupa demarcación, y se probaron tres formas de meterlo y ninguna encajó. La ficha sale en el mismo panel.
- **Leyenda** bajo el campo: las cuatro líneas y las dos situaciones.

- [x] **Paso 1: implementar.**
- [x] **Paso 2: comprobar en pantalla** en los tres formatos: ordenar por cada columna, pulsar una fila abre la ficha, y el apartado de entrenadores se pliega y se despliega.
- [x] **Paso 3: commit.** `feat(campograma): la lista ordenable y los entrenadores`.

---

### Task 7: Ajustes para un agente

**Archivos:**
- Modificar: `app/(dashboard)/ajustes/page.tsx`, `components/features/account/appearance-tab.tsx`

Hoy un agente ve en Ajustes → General «Vista predeterminada de Diseños» y los avisos de asignación y de plazos, que no le dicen nada (pendiente 13).

No hace falta función nueva: `showsCreative(access)` de `lib/utils/navigation.ts` ya responde esta pregunta.

- [x] **Paso 1: prueba** en `lib/utils/navigation.test.ts`: `showsCreative` es falso para quien solo es de Agentes, y verdadero para la cuenta de desarrollador. Si ya pasa, es la prueba de lo que se va a usar.
- [x] **Paso 2: ocultar** con `showsCreative(access)` la «Vista predeterminada de Diseños» y la sección entera de Notificaciones: sus tres avisos son de diseños, y un agente hoy no recibe ninguno. Si un día los recibe, la sección vuelve. Lo demás de Apariencia (tema, color) no se toca.
- [x] **Paso 3: comprobar.** Pruebas en verde. No hay una sesión de agente en Playwright: lo comprueba Mario con la cuenta de agente de prueba, en staging.
- [x] **Paso 4: commit.** `fix(ajustes): un agente deja de ver las preferencias de diseños`.

---

### Task 8: prueba de navegador, documentación y cierre

**Archivos:**
- Crear: `e2e/campograma.spec.ts`
- Modificar: `docs/estado-y-traspaso.md`, el spec del campograma (estado), `README.md` si cambia lo que hace el producto, `docs/testing-navegadores.md` si cambia la cobertura

- [x] **Paso 1: `e2e/campograma.spec.ts`.** Se salta sin sesión, como `titulos.spec.ts`. Comprueba solo la estructura y no compara nombres: once discos, abrir uno, cerrar, cambiar a Lista. No guarda capturas.
- [x] **Paso 2: ejecutarla** con el guion del pendiente 12. Esperado: en verde en los motores de la matriz.
- [x] **Paso 3: comprobar que no se ha colado ningún dato.** Leer los nombres de la cartera con una consulta y buscarlos en el diff de toda la fase con un guion en el scratchpad. La lista no se escribe en ningún archivo del repo. Esperado: cero coincidencias. Después `npm run build`.
- [x] **Paso 4: documentación.** §4 de noviembre del estado con lo hecho, los rodeos y lo no comprobado; pendiente 13 y 14 al día; estado del spec.
- [x] **Paso 5: revisión final con contexto limpio** y una tanda de arreglos si hace falta.
- [x] **Paso 6: commit,** y subir a `preview` cuando Mario lo pida.

---

## Fuera de este plan

- Editar: altas, cambios, bajas, historial y aviso de duplicado (fase 4).
- Comparar la cartera con el campograma suelto y retirarlo (pendiente 13).
- Que «Campograma» se corte en la barra de abajo en un iPhone de 375 de ancho (pendiente 13.4): decisión de Mario.
- Pasar el aspecto a Mochi (pendiente 14).
