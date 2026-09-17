# Plan: jugadores, carpetas y almacén (puntos 2, 3 y 4 del spec)

> **Para quien retome:** este plan ejecuta los puntos 2, 3 y 4 del orden de
> trabajo de `docs/superpowers/specs/2026-09-14-roles-departamentos-y-jugadores-design.md`
> (§5, §6, §7, §8 y el §9 que nace aquí). El punto 1 (permisos) tiene su propio
> plan, `2026-09-16-permisos-rbac.md`, y va antes.
>
> **Objetivo:** que Mario pueda, desde `preview` en su iPhone, dar de alta la
> ficha de un jugador, mandarle un enlace, entrar con otra cuenta como ese
> jugador, ver sus carpetas, subir archivos, y desde la agencia moverlos,
> entregarle material y borrarlo.
>
> **Escrito el 2026-09-17** en una sesión con Mario fuera y todo delegado salvo
> producción. La migración de este plan (046) y la 045 **no se pudieron aplicar**
> ese día: el modo automático de permisos bloquea el DDL. Quedan escritas y se
> aplican con Mario delante (pendiente 11 del estado).

## Restricciones

- Se implementa en `preview`; producción no se toca (ni merge, ni desplegar la
  función de borrar cuentas, ni migraciones que quiten nada).
- Migraciones: **solo añadir**. Producción y preview comparten base; `main` no
  conoce nada de esto y no lo va a tocar.
- Plan gratuito de Supabase: 1 GB de almacén, 50 MB por archivo, sin
  transformaciones de imagen (las miniaturas se hacen en el navegador al subir).
- Castellano en interfaz, comentarios y commits; identificadores en inglés.
- Después de cada fase: tipos, lint, tests, build; commit; push a `preview`.
- Sin `git add -A`. `PENDIENTE-MAC.md` no se versiona.

## Decisiones que no están en el spec (tomadas aquí)

1. **Numeración:** la migración de este plan es la **046**
   (`046_jugadores_y_archivos.sql`). La que borra lo antiguo del rol pasa a
   llamarse **047** (`adios_role_enum`); el plan de permisos y el estado se
   actualizan.
2. **Tablas:** `players` (la ficha) y `player_files` (todos los archivos, sean
   entregas o envíos). Las carpetas **no tienen tabla**: son una constante del
   código (`fotos`, `matchdays`), como los tipos de diseño. Un archivo con
   `folder = null` es un envío del jugador todavía sin colocar («Enviados»).
3. **La entrega es un rótulo, no una entidad:** `player_files.batch` guarda
   el nombre («Jornada 12») y se agrupa por él. Sin tabla de entregas: nada
   más lo necesita.
4. **Almacén (§9 del spec, nace aquí):** un cubo privado `jugadores`, con el
   archivo en `{player_id}/{file_id}.{ext}` y su miniatura en
   `{player_id}/{file_id}.thumb.jpg`. Las reglas de `storage.objects` sacan el
   jugador del primer tramo de la ruta. Miniaturas solo para imágenes, hechas
   en el navegador (máx. 480 px, JPEG); los vídeos van con icono.
5. **Descarga:** por archivo, con URL firmada de un minuto. «Descargar las N»
   de la maqueta se deja fuera: en iOS Safari varias descargas seguidas se
   bloquean y un zip en el navegador no cabe en esta tanda. Anotado en Abierto.
6. **La invitación de jugador es una invitación normal con `player_id`** y sin
   `role_id`. `use_invitation` la reconoce: marca la cuenta como `JUGADOR`, la
   engancha a la ficha y no da roles. `get_invitation_by_token` devuelve el
   nombre del jugador para que la pantalla de alta lo enseñe y rellene.
7. **Quién entra dónde:** el marco `(dashboard)` echa a un `JUGADOR` a
   `/area-personal`; el marco `(jugador)` echa a quien no lo sea a su casa. Y el
   middleware hace lo mismo en servidor, leyendo el perfil con sus roles una vez
   por navegación (la misma consulta que ya hacía para `/login`), para que no
   dependa del cliente.
8. **Lo que él sube:** cliente directo a Storage con supabase-js (sin pasar por
   una ruta de API): la RLS del cubo y de `player_files` son la protección.
   Límite de 50 MB por archivo (el del plan gratuito) comprobado antes de subir.

## Mapa de archivos

| Fase | Archivos |
|---|---|
| A | `supabase/migrations/046_jugadores_y_archivos.sql` · `lib/utils/players.ts` (+ test) · spec §9 |
| B | `lib/hooks/use-players.ts` · `lib/hooks/use-player.ts` (ficha y archivos) · `lib/hooks/use-own-player.ts` · `lib/services/players/files.ts` · `lib/services/invitations/token.ts` · `app/(dashboard)/jugadores/page.tsx` · `components/features/players/*` · `components/skeletons/players-skeleton.tsx` · `components/layout/app-sidebar.tsx` (nav) · `lib/supabase/middleware.ts` · `components/layout/app-layout.tsx` · `app/(jugador)/layout.tsx` · `middleware.ts` |
| C | `app/(dashboard)/jugadores/[id]/page.tsx` · `app/(auth)/invite/[token]/page.tsx` |
| D | `app/(dashboard)/jugadores/[id]/entrega/page.tsx` · `app/(dashboard)/jugadores/[id]/[folder]/page.tsx` |
| E | `components/features/jugador/area-personal.tsx` (real) · borrar `lib/jugador/datos-de-muestra.ts` · `app/(dashboard)/ajustes/page.tsx` (quitar la vista previa) |
| F | `docs/estado-y-traspaso.md` · spec (Abierto, §9) · `lib/help/tips.ts` · `README.md` · plan de permisos (047) |

---

## Fase A — La base y la lógica pura

### Tarea 1: migración 046

- [x] **Paso 1: escribir `supabase/migrations/046_jugadores_y_archivos.sql`**

Contenido completo en el archivo. Resumen de lo que hace:

- `players`: `id`, `given_name`, `family_name`, `full_name` (generada),
  `active`, `profile_id` (única, nula hasta que tenga cuenta), `created_by`,
  `created_at`, `updated_at`. RLS: todo creativo lo ve y lo gestiona; el
  jugador ve su propia ficha.
- `player_files`: `id`, `player_id`, `folder` (nulo = enviado sin colocar),
  `batch`, `name`, `storage_path` (única), `thumb_path`, `mime_type`,
  `size_bytes`, `uploaded_by`, `created_at`. RLS: creativo todo; el jugador ve
  los suyos, sube solo a `folder = null` con `uploaded_by = auth.uid()`, y
  borra solo lo suyo que siga sin colocar.
- `invitations.player_id` (cascada) + restricción «rol o jugador, no ambos».
  Políticas de `invitations` reescritas: personal con `invitar_personal`,
  jugadores con `invitar_jugadores`.
- `get_invitation_by_token` v3: añade `player_id`, `player_name`.
- `use_invitation` v3: rama de jugador (kind `JUGADOR`, enganche a la ficha,
  sin roles; falla si la ficha ya tiene cuenta).
- Cubo `jugadores` privado, 50 MB por archivo, imágenes y vídeos. Cuatro
  políticas en `storage.objects` (creativo todo; jugador lee y sube lo suyo y
  borra lo suyo sin colocar).

- [x] **Paso 2: comprobar la sintaxis sin tocar nada**: `begin; … rollback;`
  por MCP. Si el modo de permisos lo bloquea, se deja para cuando Mario
  apruebe la aplicación de verdad.

### Tarea 2: `lib/utils/players.ts` con tests

Funciones puras: `FOLDERS`, `folderLabel`, `isFolder`, `groupFilesByBatch`,
`playerSubtitle`, `expiresInLabel`, `fileKind`, `checkUploadable`,
`storagePaths`, `formatBytes`, `folderCounts`, `folderCover`.

Commit: `feat(jugadores): nace la ficha, los archivos y el cubo (migración 046, sin aplicar)`

---

## Fase B — Lista de jugadores y quién entra dónde

- [x] Hooks SWR sobre supabase-js (patrón de `use-roles.ts`): lista de fichas
  con conteos por carpeta y la invitación viva de cada una; una ficha; los
  archivos de una ficha.
- [x] `/jugadores`: lista + «Nuevo jugador» (diálogo con nombre y apellidos).
  Cuarta entrada de navegación «Jugadores» para todo creativo (la tab bar ya se
  adapta al número de secciones).
- [x] Redirecciones por clase de cuenta (decisión 7). Quitar de Ajustes la
  «vista previa».

Commit: `feat(jugadores): la agencia tiene una lista de fichas y sabe quién tiene cuenta`

## Fase C — La ficha y el alta por enlace

- [x] `/jugadores/[id]`: Cuenta (sin cuenta → crear/copiar enlace, caducidad;
  con cuenta → correo y desde cuándo), Carpetas (Fotos, Matchdays, Enviados
  por él, con conteos), «Nueva entrega», zona avanzada (renombrar, activo,
  eliminar ficha con confirmación).
- [x] `/invite/[token]`: si la invitación es de jugador, cabecera «Área
  personal · Nombre», campos Nombre, Apellidos (uno solo), Correo, Contraseña,
  Confirmar contraseña. La de personal sigue como está.

Commit: `feat(jugadores): la ficha manda el enlace y la cuenta nace enganchada a ella`

## Fase D — Entregas y carpetas desde la agencia

- [x] `/jugadores/[id]/entrega`: carpeta, nombre del lote, archivos (con
  miniatura al vuelo), «Entregar a Nombre». Subida secuencial con progreso.
- [x] `/jugadores/[id]/[folder]` (`fotos`, `matchdays`, `enviados`): rejilla
  por lote; por archivo: ver/descargar, mover a otra carpeta, eliminar.

Commit: `feat(jugadores): la agencia entrega, mueve y borra archivos`

## Fase E — El área personal de verdad

- [x] `area-personal.tsx` con datos reales: portadas y conteos, subir
  archivos (imagen/vídeo, hasta 50 MB), «N enviados» con quitar, carpeta por
  lote con vista previa y descarga.
- [x] Borrar `lib/jugador/datos-de-muestra.ts`.

Commit: `feat(jugador): el área personal deja de ser una maqueta`

## Fase F — Documentación y remates

- [x] Spec: §9 almacén; Abierto actualizado; §5/§8 «implementado».
- [x] Estado: §4 de septiembre; pendiente 11 incluye la 046; 047 en vez de 046
  para lo antiguo del rol.
- [x] Plan de permisos: tarea 11 → 047.
- [x] Un consejo en `lib/help/tips.ts` para «Enviados por él».
- [x] README: una línea sobre jugadores.

Commit: `docs(jugadores): queda escrito cómo se guardan los archivos y qué falta`

---

## Revisión con contexto limpio (2026-09-17, antes de aplicar la 046)

Un agente sin el contexto de la sesión leyó la 046, las consultas, el almacén,
las redirecciones y la interfaz, con el catálogo vivo delante. Seis hallazgos
con caso concreto, todos corregidos el mismo día (commit siguiente al
`cf67230`); ninguno en consultas PostgREST ni en la interfaz.

| # | Gravedad | Qué fallaba | Qué se hizo |
|---|---|---|---|
| 1 | alta | La política de INSERT de `player_files` no ataba la ruta a la fila, y la de DELETE del cubo buscaba *cualquier* fila con esa ruta: un jugador creaba una fila suya apuntando a un objeto entregado y lo borraba. | Dos restricciones en `player_files` (`storage_path like {player_id}/{id}.%`, `thumb_path = {player_id}/{id}.thumb.jpg`) y la regla del cubo busca la fila por el jugador del primer tramo y el id del nombre del objeto. |
| 2 | alta | El perfil del jugador nacía con `profiles.role = 'DESIGNER'` y `main` filtra por esa columna: lo listaba en Equipo y le repartía diseños. | Valor `JUGADOR` en `role_enum`; `handle_new_user` v3 lo pone si el alta manda `kind: 'JUGADOR'`; `use_invitation` lo confirma. |
| 3 | media | `use_invitation` no comparaba `p_user_id` con quien llama: con un enlace válido se podía degradar a JUGADOR cualquier cuenta de la agencia. | Exige `auth.uid() = p_user_id`; sin sesión (correo por confirmar), solo un perfil de menos de 15 minutos sin roles ni ficha. |
| 4 | baja | Si fallaba el insert de la fila tras subir, el jugador no podía borrar los objetos (la regla exige fila): huérfanos. | La fila se crea antes que los objetos; si la subida falla se retiran objetos y luego la fila. |
| 5 | baja | `deletePlayer` listaba mil objetos y paraba. | Pagina de 500 en 500 hasta vaciar. |
| 6 | baja | Con sesión inmediata tras el alta, el cliente se quedaba con el perfil viejo y el marco del jugador entraba en bucle. | Tras `use_invitation`, cierra sesión y recarga a `/login`. |

Además: la descarga abre la pestaña antes del `await` (Safari bloquea popups
que no nacen del toque). Lo que el revisor no pudo verificar y sigue sin
verificarse: que `storage.remove()` ignore en silencio lo que la RLS no deja
borrar (base del arreglo 4), el ajuste «Confirm email» del proyecto, y el
comportamiento real en iOS.

## Verificación que no se pudo hacer el 2026-09-17

Todo lo que necesita la base con la 046 aplicada: crear una ficha, mandar el
enlace, darse de alta como jugador, subir y mover archivos. Lo automático
(tipos, lint, tests, build) sí se hizo en cada fase. Al aplicar la 045 y la
046, hacer el recorrido entero desde el iPhone y anotar aquí lo que falle.
