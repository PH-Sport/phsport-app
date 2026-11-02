# Quitar Jugadores de la app — plan de implementación

> **Para agentes:** se ejecuta en la sesión principal, tarea a tarea (Mario
> prefiere que implemente la sesión principal y que los subagentes revisen).
> Los pasos usan casillas (`- [ ]`) para seguir el avance.

**Objetivo:** que la sección Jugadores (fichas, carpetas para subir fotos, alta
del jugador por enlace y su área personal) desaparezca de la app antes de subir
`preview` a `main`, sin tocar lo que usan el equipo y Agentes.

**Enfoque:** se quita el código, no la base. Lo único que se toca en la base es
el permiso que deja crear invitaciones de jugador, para que no pueda nacer una
cuenta de jugador mientras se desmonta su lado de la app. Tablas, cubo,
funciones y la clase de cuenta `JUGADOR` se quedan hasta la limpieza tras el
merge (pendiente 11 del estado), o para siempre si Jugadores vuelve.

**Origen:** decisión de Mario del 2026-11-02, pendiente 14.2 de
`docs/estado-y-traspaso.md`. Lo que se quita se construyó en el §4 de
septiembre de ese documento.

## Restricciones

- La base es la de producción. La migración de la tarea 1 se aplica **solo con
  el permiso expreso de Mario**, y antes se lee el estado vivo
  (`.claude/rules/migraciones.md`).
- Siguiente número libre: **052** (la 049 está reservada para después del merge).
- **No se toca la cartera de Agentes**: `portfolio_*`, `portfolio_names()` y el
  permiso `dar_de_baja_jugadores` son otra cosa con un nombre parecido.
- **El middleware no gana consultas** (`.claude/rules/region-y-middleware.md`):
  el camino normal sigue sin leer la base.
- Se queda el tipo `AccountKind = 'AGENCIA' | 'JUGADOR'` y la barrera de
  `deriveAccess` (una cuenta que no es de la agencia no obtiene permisos),
  porque la base sigue teniendo esa clase de cuenta.
- Nombres de prueba inventados en los tests; ningún dato real de jugador en el
  repo.
- Después de cada tarea: `npx tsc --noEmit`, `npm run lint`, `npm test` y
  `npm run build`. Un commit por tarea, solo con el visto bueno de Mario.

## Dónde mirar al revisar (lo que las pruebas no cubren)

1. **El alta de personal por invitación sigue funcionando.** La pantalla de
   alta pierde la rama del jugador y es la que estuvo meses rota en verano.
2. **Con sesión abierta, entrar en `/login` lleva a la página de inicio de cada
   uno** (equipo a `/inicio` o `/mi-semana`, agente a `/campograma`). El
   middleware pierde la comprobación de «marco equivocado».
3. **Una cuenta de Agentes sigue entrando solo al campograma**, y las pantallas
   de creativo le siguen cerradas.
4. **La tab bar del iPhone con tres entradas y el botón de crear** se ve bien.
5. **Un enlace guardado a `/jugadores/...` o a `/area-personal`** da la página
   de «no encontrado», no un error ni un bucle de redirecciones.

---

### Tarea 1: cerrar la puerta en la base

Hoy los tres roles de creativo (Diseñador, Diseñador senior y Gestor creativo)
tienen `invitar_jugadores`, y con él la base deja crear invitaciones de jugador
(`can_manage_invitation`) aunque la app ya no tenga botón. Se quita el permiso
de los roles; el resto de la base no se toca.

**Archivos:**
- Crear: `supabase/migrations/052_sin_invitar_jugadores.sql`
- Modificar: `lib/utils/access.ts` (sale `'invitar_jugadores'` de `PERMISSIONS`)
- Modificar: `lib/utils/access.test.ts` (los ejemplos que lo usan pasan a otro
  permiso que siga existiendo)

- [ ] **Paso 1:** leer el estado vivo: filas de `role_permissions` con
  `invitar_jugadores` (hoy, tres) y la definición de `can_manage_invitation`.
- [ ] **Paso 2:** escribir la migración: un `delete from public.role_permissions
  where permission = 'invitar_jugadores'`, con un comentario que diga por qué,
  que `main` no lee permisos y cómo se revierte (volver a insertar las tres
  filas).
- [ ] **Paso 3:** quitar el permiso de `PERMISSIONS` y ajustar los tests.
  `normalizeProfile` ya descarta los permisos que el código no conoce.
- [ ] **Paso 4:** tipos, lint, tests y build.
- [ ] **Paso 5:** con el permiso de Mario, aplicar la 052 por MCP y comprobar:
  cero filas con `invitar_jugadores`, y `can_manage_invitation(<id de un
  gestor>, null, <id de una ficha>)` devuelve `false`.
- [ ] **Paso 6:** commit.

### Tarea 2: el lado del jugador y el alta

Va sola porque toca el alta y el middleware, que corre en cada navegación. Si
algo se rompe, se sabe dónde.

**Archivos:**
- Borrar: `app/(jugador)/` entero, `components/features/jugador/`,
  `lib/hooks/use-own-player.ts`
- Modificar: `lib/utils/access.ts`: `ViewMode` pierde `'player'`;
  `viewModeFor` pierde la línea de `JUGADOR`; `homeFor` pierde su caso.
- Modificar: `lib/utils/access.test.ts`: fuera las expectativas de
  `'player'` y `/area-personal`. Se queda la de que una cuenta `JUGADOR` no
  obtiene permisos.
- Modificar: `lib/supabase/middleware.ts`: fuera `isPlayer`, `isPlayerArea` y
  `wrongFrame`. Con sesión, solo las rutas públicas leen el perfil y
  redirigen a `homeFor(viewModeFor(perfil))`.
- Modificar: `middleware.ts`: fuera `'/area-personal/:path*'` del `matcher`.
- Modificar: `components/layout/app-layout.tsx`: fuera la redirección del
  jugador.
- Modificar: `app/(auth)/invite/[token]/page.tsx`: fuera la rama de
  jugador (`playerId`, `playerName`, `kind: 'JUGADOR'`, el campo de confirmar
  contraseña y los textos que cambian según `isPlayer`). La pantalla queda
  como la de personal de antes de septiembre, con el rol de la invitación.
- Modificar: comentarios que hablan del jugador en
  `lib/services/invitations/token.ts` y `e2e/sesion.setup.ts`.

- [ ] **Paso 1:** ajustar los tests de `access` y verlos fallar.
- [ ] **Paso 2:** cambiar `access.ts` y verlos pasar.
- [ ] **Paso 3:** borrar y modificar el resto de la lista.
- [ ] **Paso 4:** tipos, lint, tests y build.
- [ ] **Paso 5:** recorrido con la sesión de e2e contra `npm start`.
  Comprobar: entrar en `/login` con sesión lleva a la página de inicio;
  `/area-personal` da «no encontrado»; `/invite/<token inventado>` enseña «Esta
  invitación no existe o ha sido eliminada».
- [ ] **Paso 6:** revisión con contexto limpio del diff de esta tarea (alta y
  middleware), pidiendo expresamente los puntos 1, 2 y 5 de «Dónde mirar».
- [ ] **Paso 7:** commit.

**Comprobación que solo puede hacer Mario:** crear una invitación de personal
desde Ajustes → Miembros en staging, abrir el enlace en una ventana privada y
ver el formulario, sin completar el alta (completarla crearía una cuenta real).

### Tarea 3: las pantallas de la agencia y la navegación

Mecánica: cuando el área personal ya no existe, todo lo compartido queda solo
para estas pantallas y sale con ellas.

**Archivos:**
- Borrar: `app/(dashboard)/jugadores/` entero, `components/features/players/`,
  `components/skeletons/players-skeleton.tsx`,
  `components/skeletons/player-detail-skeleton.tsx`, `lib/hooks/use-player.ts`,
  `lib/hooks/use-players.ts`, `lib/hooks/use-thumb-urls.ts`,
  `lib/hooks/use-require-department.ts` (solo lo usaban estas pantallas),
  `lib/services/players/`, `lib/utils/players.ts` y `lib/utils/players.test.ts`
- Modificar: `lib/utils/navigation.ts`: fuera `'/jugadores'` de
  `ROUTE_DEPARTMENTS` y `'jugadores'` de `NavKey` y de `navKeysFor`.
- Modificar: `lib/utils/navigation.test.ts`: creativo ve
  `['inicio', 'semana', 'disenos']`.
- Modificar: `components/layout/app-sidebar.tsx`: fuera la entrada. El icono
  `Users` sale del import si nadie más lo usa.
- Modificar: `lib/ui/section-label.ts`: fuera `jugadores`.
- Modificar: `middleware.ts`: fuera `'/jugadores/:path*'` del `matcher`.
- Modificar: `lib/help/tips.ts`: fuera la sección `jugadores` (de
  `HelpSection` y de `HELP_SECTIONS`) y sus dos consejos
  (`enviados-son-de-la-agencia`, `enlace-jugador-caduca`). Sus anclas solo
  existieron en staging.
- Modificar: el comentario de `components/ui/section.tsx`, que nombra las
  pantallas de Jugadores.

- [ ] **Paso 1:** ajustar los tests de navegación y verlos fallar.
- [ ] **Paso 2:** cambiar `navigation.ts` y verlos pasar.
- [ ] **Paso 3:** borrar y modificar el resto.
- [ ] **Paso 4:** comprobar que no queda nada colgando:
  `grep -rn -E "players|jugador|area-personal|use-thumb-urls|useRequireDepartment" app components lib middleware.ts e2e`.
  Solo deben salir la cartera (`portfolio`, `dar_de_baja_jugadores`), el
  campo «jugador» de los diseños y el autocompletado.
- [ ] **Paso 5:** tipos, lint, tests y build.
- [ ] **Paso 6:** recorrido con la sesión de e2e en escritorio e iPhone:
  la barra lateral y la tab bar enseñan Inicio, Semana y Diseños; `/jugadores`
  da «no encontrado»; `/ayuda` no tiene la sección. Captura de la tab bar.
- [ ] **Paso 7:** commit.

### Tarea 4: documentación y staging

**Archivos:**
- `docs/estado-y-traspaso.md`: pendiente 14.2 HECHO. Una línea al principio
  del §4 de septiembre: retirado de la app en tal fecha, y la base sigue. Los
  restos de Jugadores en el pendiente 12 salen. En el pendiente 11, la lista de
  lo que queda en la base para la limpieza tras el merge.
- `README.md`: fuera el párrafo de Jugadores.
- `CLAUDE.md`: fuera `jugadores` del árbol de `app/(dashboard)/`.
- El mapa (`feat/mapa`) se pone al día cuando esa rama se junte con `preview`.

- [ ] **Paso 1:** escribir lo anterior.
- [ ] **Paso 2:** commit y, con el visto bueno de Mario, subir a `preview` y
  comprobar que Vercel sale en verde.
