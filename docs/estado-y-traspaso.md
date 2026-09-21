# Estado del proyecto y traspaso

> **Actualizado:** 2026-09-21, al mudar la app a Dublín (§5 de septiembre): el
> servidor pasa de 1,3–3,5 s a 0,4–0,9 s en empezar a responder, y la clase de
> cuenta viaja en la sesión (migración 047, aplicada). Queda lo demás que Mario
> vio en el iPhone —la banda de la cabecera (con contorno de diagnóstico puesto),
> el pulido y las transiciones de Jugadores— y el recorrido de jugadores:
> pendiente 12. Antes, el 2026-09-17, al cerrar en código los cuatro puntos del
> salto a «app de la agencia» (§3 y §4): permisos por roles, fichas de jugadores
> con alta por enlace, carpetas y archivos, y el almacén, con las migraciones
> 044, 045 y 046 aplicadas. `preview` va por delante de `main` y no se sube
> hasta que Mario lo dé por bueno: primero se termina todo aquí.
> Antes, el 2026-09-14, al arrancar el salto de «panel del equipo de
> diseño» a «app de la agencia» — ver el §2 de septiembre y el pendiente 8, que
> es un agujero de permisos que hay que cerrar antes de meter gente de fuera.
> Antes, el 2026-09-08, al publicar el sistema de consejos y la sección de
> Ayuda. Y el 2026-09-07, al preparar el salto a otro equipo. Lo de fondo
> sigue siendo del 2026-08-22, cuando se subieron a producción los 95 commits que
> llevaban meses en `preview`: `main` y `preview` van a la par.
> **Para qué sirve:** que quien retome —persona o Claude Code, en cualquier
> máquina— sepa dónde está cada cosa, por qué se decidió así y qué falta. Las
> convenciones de trabajo están en `CLAUDE.md`; los servicios, claves y correo
> que hay detrás, en `docs/operaciones-y-entorno.md`.
>
> **Qué se hizo el 2026-09-07:** el proyecto dejó de depender de la memoria local
> de una sola máquina. Se volcó al repositorio todo lo operativo que vivía solo
> ahí, se añadieron dos pendientes que no constaban (§6 y §7) y se corrigieron
> cuatro incoherencias que habrían hecho perder el primer día en un equipo nuevo:
> la versión de Node, una variable de entorno que no existe, la lista de
> variables y la versión de React.
>
> **Y se subió a `main` el mismo día**, en contra de la costumbre de dejar
> reposar lo nuevo en `preview`. El motivo: son tres commits de documentación
> —más `.nvmrc` y la plantilla de entorno—, sin una línea de código, y quien
> clona el repositorio aterriza en `main`. Dejarlo solo en `preview` significaba
> que el primer contacto desde el equipo nuevo seguiría siendo con las
> instrucciones equivocadas, que es justo lo que se venía a arreglar.

---

## Dónde está cada cosa

| Rama | Contenido |
|---|---|
| `main` | Lo que corre en producción. |
| `preview` | Donde se implementa. |

**`preview` va por delante desde el 2026-09-16** con la tanda de permisos por
roles (§3 de septiembre) y todo lo que venga detrás; `main` la recibe cuando
Mario lo haya probado en staging. Antes iban a la par desde el 2026-08-22, cuando
se subieron a producción los 95 commits que llevaban meses acumulados: el rediseño iOS 26
entero, la fase 1.5 de contenido y voz, el chat de creación de diseños y los
arreglos del alta por invitación. Fue un fast-forward limpio, sin merge commit.

**El flujo de ramas ya está por escrito** en `CLAUDE.md`, apartado «Ramas»: se
implementa en `preview` y `main` solo recibe lo probado. Hasta ahora era un
acuerdo tácito y no constaba en ningún sitio.

### Cuidado: la base de datos va por delante del código

**Vuelve a ir por delante desde el 2026-09-16, y esta vez a propósito.** La
migración 044 (y la 045 cuando se aplique) están en producción antes que su
código, porque `preview` y producción comparten base. Las dos están pensadas
para convivir con `main`: añaden reglas y columnas, no quitan ninguna que
`main` lea. La que quita —la 046— espera al merge. Ver §3 de septiembre.

Entre el 2026-08-22 y el 2026-09-16 estuvieron igualadas. Lo que sigue se deja
escrito porque explica por qué tres migraciones del repo no hay que ejecutarlas
nunca.

Las migraciones `041`, `042` y `043` se aplicaron **directamente sobre la base de
producción** antes de que su código estuviera desplegado: la `041` para arreglar
el enlace de los avisos de asignación, y la `042` y la `043` el 2026-08-20 para
desatascar el alta de Loren, que no podía esperar a una release. Las tres están
registradas en el historial de migraciones de Supabase.

Los archivos del repo son la copia para el control de versiones, no algo
pendiente de ejecutar. Volver a lanzarlas sería inofensivo pero innecesario.

---

## Qué se hizo en agosto de 2026, y por qué

Todo salió de un aviso: «Izan reasignó tres diseños a Lluís y a Lluís no le
salen».

### 1. La reasignación nunca estuvo rota

El `UPDATE` se escribía bien; el `audit_log` lo confirmaba. Lluís no los
encontraba porque **entregaban el lunes siguiente**, y ninguna vista por defecto
llega tan lejos: Inicio y Diseños se ciñen a la semana en curso, y «Mi semana»
mira de −7 a +21 días. El trabajo estaba bien asignado y era invisible.

### 2. El enlace de los avisos de asignación (`d5ce575`)

`notify_on_assignment` escribía `/communications/<id>`, una ruta retirada hace
tiempo que `next.config.js` redirige a `/inicio` **descartando el id**. Quien
pulsaba «Te han asignado el diseño X» aterrizaba en Inicio sin rastro de nada.
Llevaba roto desde el 28 de enero: 90 avisos, todos sin leer.

Ahora apunta a `/disenos?open=<id>`, que la página ya sabía interpretar y que
abre el detalle cargándolo por id, al margen del filtro de semana. Los 90
antiguos se reescribieron en la misma migración; los tres triggers de la tabla
son `AFTER INSERT`, así que ese `UPDATE` no reenvió correos ni push.

### 3. Aviso de trabajo en semanas futuras (`df43fd5`, `1ee583b`)

El rótulo de Inicio dice ahora también lo que espera detrás: «Semana del 10 ago –
16 ago · 2 más a partir del lun 17 ago». Decisiones tomadas:

- **Mudo, sin enlace.** Lo que resuelve el problema es enterarse. Hacerlo
  clicable obligaba a enseñar a `/disenos` a leer el rango desde la URL, porque
  `useDesignsFilters` es estado local, y para un admin `/mi-semana` no sirve.
- **Con fecha, no «la semana que viene»**, que mentiría si lo siguiente cae a un
  mes vista.
- **Techo de 8 semanas.** El horizonte real de PHSPORT es de 2-3, así que no
  recorta nada real y evita que una fecha mal tecleada asome como trabajo.
- **En móvil, un punto con haz en vez de la frase**, que no cabía y se partía. Es
  el mismo gesto que la campana usa para «tienes algo sin leer», con el texto
  completo en `sr-only`.

Lógica pura en `lib/utils/upcoming-work.ts` con tests; el fetch, aparte en
`lib/hooks/use-upcoming-work.ts`, para no ensanchar `useDashboard` ni tocar sus
KPIs ni su caché.

### 4. La cabecera móvil (`e17f6e6`, `653fbb2`, `136bd43`, `c7ae6a9`)

- **La píldora de rol salió de la barra.** Anunciaba algo que no cambia y que ya
  aparece en el menú de perfil. Se conserva el aviso «Viendo como Diseñador · X»,
  que no es decorativo: avisa de un estado temporal y es la salida de un clic.
  El componente pasó a llamarse `ViewAsPill`.
- **La barra dejó de reservar 56px en móvil**, que con el título grande a la
  vista no compraban nada. Se consigue con `sticky` + margen inferior negativo,
  **no con `fixed`**: `fixed` fue el primer intento y se portó mal en iPhone. La
  barra cuelga de un `motion.div`, y un ancestro animado por framer-motion puede
  establecer *containing block*, con lo que `fixed` deja de referirse al
  viewport.
- **Los saludos largos se descartan en móvil.** Con menos ancho se cortaban. El
  filtro mide el saludo **ya montado con el nombre**, en vez de mantener una
  segunda lista que se desincronizaría; así aguanta nombres largos. Con nombres
  de 5 letras se pierden 5 de 19 saludos, entre ellos «Buenas tardes» y «Buenas
  noches». Si molesta: bajar el título a `text-xl` en móvil los recupera casi
  todos.

### 5. El fallo que costó cuatro intentos (`c7ae6a9`)

Al quitar los 56px, el título pasó a nacer **dentro** de la franja de la barra,
mientras el `IntersectionObserver` de `page-header.tsx` seguía descontando el
alto de la barra por arriba. Daba el título por pasado nada más cargar: la barra
se ponía opaca al instante y **el título grande no se veía nunca en móvil**. Se
leía el rótulo pequeño encima del título a medio tapar.

**No era Safari.** Pasaba en todos los motores; en escritorio no se notaba porque
allí la barra sigue empujando el contenido. Antes de dar con ello se acusó sin
pruebas al recorte de capas opacas de Safari 26 y a `position: fixed` bajo
framer-motion. Se diagnosticó en minutos al poder **mirar** la app con capturas.

Dos cambios que salieron de aquellas teorías se quedan, comentados, porque son
inofensivos: el fondo con alpha `0.99` (red de seguridad ante Safari 26) y la
vuelta a `sticky`, que es preferible con o sin bug.

### 6. Los dos remates de la cabecera móvil (`0f4ebe5`, `b8e26eb`)

Cerraban la lista de pendientes del rediseño iOS 26. Los dos son de aspecto, sin
lógica detrás.

- **El contenido se desvanece bajo la tab bar.** La barra flota, así que el
  contenido le pasa por detrás y asomaba nítido y cortado a media altura en el
  hueco que queda hasta el borde. Una capa fija de degradado lo apaga contra el
  fondo antes de llegar ahí: es el otro extremo del *scroll edge effect* que la
  cabecera ya tenía arriba. Tres paradas y no dos —la intermedia al 50%— porque
  con dos se ve una banda gris sobre el contenido.
- **Los títulos de página se quedaron sin icono.** Ajustes, Mail y Salud no
  ilustran sus títulos grandes; con un icono al lado, el título parecía más el
  encabezado de una tarjeta que el de una pantalla. Fuera las cuatro props
  `icon=`. La prop sigue en la firma de `PageHeader` sin usuarios: quitarla no
  aporta y toca dos componentes más.
- **De propina:** tres skeletons seguían reservando la línea del subtítulo que se
  eliminó de esas páginas en agosto, y saltaban al cargar. El de `/inicio` la
  conserva porque allí el subtítulo **sí** existe: es el rango de la semana, que
  es un dato y no una descripción.

Con esto **la «tanda D» del rediseño iOS 26 deja de existir como lista propia**.
Era una enumeración de remates sueltos, y lo que quedaba de ella lo absorbió el
criterio de superficies («la caja marca lo que se toca, el plano lo que se lee»),
que es mejor guía. No busques un plan de tanda D: no lo hay ni hace falta.

### 7. Matriz de navegadores (`ad6bfb2`, `db516ec`)

Cuatro proyectos de Playwright y 40 tests. **Lee `docs/testing-navegadores.md`
antes de fiarte de un verde**: Playwright emula dispositivos, no sistemas
operativos, y trae una sola build de cada motor. No hay «iOS 18 frente a 26», y
`ios-safari-aprox` no es Safari de iPhone.

---

### 8. El alta por invitación llevaba meses rota (migración `042`)

Loren vuelve al equipo, se le pasa un enlace de invitación, rellena el formulario
y **el botón «Crear cuenta» no hace nada**. No era cosa suya ni de que se le
borrase la cuenta: le habría pasado a cualquiera.

La cadena, de fuera a dentro:

1. La migración `025` escribió `SET search_path = 'public, pg_temp'` **con
   comillas**. Postgres no lo lee como dos esquemas: lo lee como **uno solo
   llamado literalmente «public, pg_temp»**, coma incluida. Se comprueba en un
   segundo: con ese `search_path`, `to_regclass('invitations')` devuelve `null`
   y `to_regclass('public.invitations')` sí resuelve.
2. `validate_invitation` era **la única** función del flujo que nombraba sus
   tablas sin cualificar. Sus hermanas (`use_invitation`, `handle_new_user`)
   escriben `public.` delante y se salvaban **de casualidad**.
3. Al no encontrar la tabla lanzaba `42P01 relation "invitations" does not
   exist`, y **PostgREST traduce ese error a un HTTP 404**. Por eso parecía que
   faltaba la función, cuando lo que fallaba era su cuerpo.
4. El formulario recibía el error y llamaba a `toast.error(...)` — invisible,
   porque la app no montaba `<Toaster/>` (ver abajo).

**Desde cuándo:** el último alta que funcionó es la de Diego, el 20 de abril. Hay
una invitación del 17 de junio que caducó con 0 usos. Así que estuvo roto entre
esas dos fechas, y nadie se enteró porque no entró gente nueva.

**Cómo se encontró, que es lo que vale para la próxima:** los logs. En 24 h no
había **ni un solo** `POST /signup` en `auth_logs`, lo que descartó de golpe todas
las teorías sobre la cuenta borrada de Loren. En `edge_logs` estaban los nueve
404 de `validate_invitation` contra los 200 de `get_invitation_by_token`. Con eso
la llamada se reprodujo con la clave anónima y un UUID inventado, y el cuerpo del
error lo dijo todo. Teorizar sobre el borrado de Loren habría costado horas.

**Las otras 14 funciones con el mismo `search_path` mal escrito se quedan como
están.** Están revisadas una a una: todas cualifican sus tablas con `public.`, así
que hoy funcionan. Pero funcionan por costumbre, no por diseño — están a un
`CREATE OR REPLACE` descuidado de romperse igual. Ver pendientes.

### 9. Ningún aviso de la app se había visto nunca

`toast()` se llama desde 12 archivos, pero **`<Toaster/>` no estaba montado en
ninguna parte**, y `git log -S'Toaster' --all` confirma que nunca lo estuvo.
Sonner no dibuja nada sin ese componente: las llamadas se ejecutan sin error y
sin pintar. Toda la app llevaba desde el primer día tragándose sus avisos, los de
error y los de éxito.

Se monta en el layout raíz, dentro de `ThemeProvider` (necesita `useTheme`) y
fuera del `AuthProvider`, para que cubra también las pantallas de auth, que viven
fuera del shell del dashboard. Arriba y centrado: en móvil la tab bar flota sobre
el borde inferior y un toast abajo le cae encima.

Esto es lo que convirtió un error concreto en «no hace nada», que es mucho más
caro de diagnosticar. Si algo vuelve a fallar en silencio, sospechar primero de
un aviso que no se ve.

### 10. El segundo fallo del alta, justo detrás del primero (migración `043`)

Arreglada la `042`, Loren lo intentó de nuevo y **entró** — pero el alta quedó a
medias sin que se notara. Los logs lo enseñaron en tres líneas:

```
15:23:13  rpc/validate_invitation  → 200   (la 042 ya funcionaba)
15:23:14  cuenta creada
15:23:16  rpc/use_invitation       → 400   ← falla aquí
```

**La causa:** `invitations.role` es `text` y `profiles.role` es `public.role_enum`.
Postgres no convierte uno en otro por su cuenta, así que
`UPDATE public.profiles SET role = v_invitation.role` reventaba con `42804`
**siempre**, fuera cual fuera el valor. Nació el 2026-04-23 con el commit
`f014860` («apply invitation role server-side»), tres días después del último
alta que funcionó.

**Lo que provocaba, y es lo importante:** la cuenta se crea igual, porque de eso
se encarga el trigger `on_auth_user_created` en otra transacción. Pero la
invitación **no se consume** y el rol **no se aplica**. El nuevo miembro entra
siempre como `DESIGNER`, que es el valor por defecto del trigger. Con una
invitación de `ADMIN` habría entrado con menos permisos de los debidos, y el
enlace habría seguido vivo para cualquiera que lo tuviese.

Se arregla con un cast explícito, `v_invitation.role::public.role_enum`. Es
deliberado y no defensivo: si alguien mete otra cosa en esa columna, el enum lo
rechaza en vez de asignar basura. **Que las dos columnas no compartan tipo es la
deuda de fondo y sigue ahí** (ver pendientes).

Se verificó con la función real, creando una invitación de `ADMIN` de mentira,
llamando a `use_invitation` y abortando la transacción a propósito para
deshacerlo todo: devolvió `true`, aplicó el rol `ADMIN` y registró el uso.

**Arreglado a mano lo que quedó torcido:** se registró el uso perdido de Loren en
`invitation_uses` (fechado con su alta real, no con el momento del apaño) y se
caducó la otra invitación del día, que se había quedado viva y sin usar. Su rol
no hubo que tocarlo: la invitación era de `DESIGNER` y ya lo era por defecto.

**La lección de las dos migraciones juntas:** los dos fallos los introdujeron
migraciones de seguridad aplicadas a mano, y los dos vivieron meses porque el
camino no lo recorría nadie. Un cambio en un flujo que no se ejercita no está
probado por mucho que los tests pasen — aquí pasaban los 144.

### 11. «La tarjeta 8» no era la misma para el usuario y para el agente

El taller numera las tarjetas en pantalla sobre **todas**, incluidas las que
están a medio rellenar. Al agente se le mandan solo las no vacías —son ruido, y
además le invitarían a rellenarlas— pero se numeraban **después** de filtrar, así
que volvía a contar desde uno sobre las que quedaban.

Con una tarjeta vacía en la posición 3, la que el usuario ve como la 8 le llegaba
al agente como `#7`. Decirle «en la tarjeta 8 cambia el diseñador a Izan» le
cambiaba el diseñador a otra. Y no fallaba de forma ruidosa: hacía el cambio,
confirmaba que lo había hecho, y todo parecía correcto.

Ahora el número se fija antes de filtrar. El agente puede recibir «1, 2, 4»: el
hueco es la tarjeta vacía y no le estorba, porque para modificar identifica por
`id`, no por número. El número existe solo para que las dos partes hablen de la
misma tarjeta.

**El contrato que hay que respetar de aquí en adelante:** el número que ve el
agente es la posición en el taller completo, no en la lista que se le manda. Si
alguien vuelve a filtrar antes de numerar, esto reaparece.

De paso quedó claro que el agente **ya sabía** modificar tarjetas del taller: la
herramienta `update_designs` existe desde el principio y cubre el diseñador, el
tipo, la fecha y el resto de campos. Lo que faltaba no era la capacidad, era que
los números coincidieran.

## Qué se hizo en septiembre de 2026, y por qué

### 1. Sistema de consejos y sección de Ayuda

Cierra el pendiente §7 de la lista de abajo, anotado el 2026-07-02 y aparcado
desde entonces. **El diseño completo está en
`docs/superpowers/specs/2026-09-08-sistema-consejos-ayuda-design.md`**; aquí solo
lo que hay que saber para no romperlo.

**De dónde salió el contenido.** No de imaginar dudas: de este mismo documento.
El consejo principal —«si falta un diseño, mira las fechas antes que nada»— es
literalmente el §1 de agosto, el caso de Lluís. El del buscador es esa misma
trampa por otra puerta. Los del peso salen de `DESIGN_TYPE_WEIGHT`, y el de la
numeración de tarjetas, del §11.

**Todo el texto vive en `lib/help/tips.ts`, y solo ahí.** De ese catálogo beben
las tres caras: el aviso en contexto (`<Tip>`), el «?» (`<HelpHint>`) y la página
`/ayuda`. Añadir un consejo es añadir una entrada; no hay que tocar ninguna
pantalla. **Los `id` son anclas públicas** (`/ayuda#<id>`) y a la vez la clave con
la que se recuerda un descarte: renombrar uno rompe enlaces guardados y hace
reaparecer un aviso ya visto.

**Los descartes se guardan en `localStorage`**, no en `profiles`. Es una decisión,
no un atajo: no hay base de pruebas —la de desarrollo es la de producción— y el
historial de migraciones ya está divergido. El precio es que un aviso ya visto
reaparece una vez al entrar desde otro aparato. Hay un botón en `/ayuda` para
volver a mostrarlos todos.

**Convive con los tooltips `Hint`, no los sustituye.** `Hint` es una etiqueta de
una línea que nombra un control («Marcar como entregada») y necesita puntero. El
«?» es un popover con explicación, y funciona al tacto. Antes de añadir uno,
mirar cuál de los dos toca.

**Los avisos salen donde duele, no al entrar en la sección.** Cuatro sitios: la
lista vacía de Diseños, la semana despejada de Mi semana, el rótulo «Tipo» del
taller y la píldora «Sobrecarga» de Semana. Un aviso que sale siempre deja de
leerse a la segunda vez; si se añaden más, que sea con ese mismo criterio.

**Lo que no se hizo, y por qué:** ni tour guiado —para un equipo que ya usa la app
a diario es un estorbo que se salta— ni cuarta pestaña en la tab bar móvil, que
son tres secciones de trabajo diario y esto se consulta de uvas a peras. La
entrada está en el pie de la barra lateral y en el menú de perfil, igual que
Ajustes.

**Sin comprobar:** el aspecto en pantalla. Desde este equipo no hay credenciales
de Playwright, así que los tests que necesitan sesión se saltan y no se ha podido
entrar a mirar. Va a `preview` precisamente para eso.

### 2. Arranca el salto a «app de la agencia»

**El diseño completo está en
`docs/superpowers/specs/2026-09-14-roles-departamentos-y-jugadores-design.md`.**
Aquí solo lo que cambia el estado del proyecto.

**Lo que viene:** la gestión de diseños pasa a ser una sección más —la de los
perfiles creativos— y se añaden departamentos: agentes y scouts por un lado,
futbolistas representados por otro. Lo de fondo es que **entra gente de fuera**,
y eso rompe supuestos que llevan aquí desde el principio.

**Los cuatro puntos del orden de trabajo están confirmados por Mario**
(2026-09-16): permisos, ficha y alta, carpetas y archivos, almacenamiento. El
spec es la guía para completarlos. **Los cuatro están hechos y su base
aplicada** (el 2026-09-17; permisos en el §3, el resto en el §4). Lo que falta
es rodarlos: el recorrido entero desde el iPhone y los retoques de fluidez
(pendiente 12). El área personal del futbolista, que empezó como maqueta con
datos inventados en el grupo de rutas `app/(jugador)/`, es ya la de verdad.

**El hallazgo que cambia prioridades está en el pendiente 8.**

**Lo que se descartó por el camino, para no repetirlo:**

- **Conectar `designs.player` con una ficha de jugador** para que cada chaval
  viera «sus» diseños. No va por ahí: los diseños son de la agencia y el acceso
  se concede a mano, no se deriva de quién sale en la pieza. De paso se ahorra
  reconciliar los nombres escritos a mano, que era lo más pesado del plan.
- **Guardar los archivos en Drive.** Se recomendó con estimaciones infladas; con
  los números reales (20 fotos al mes por chaval) caben de sobra en la app. Pero
  **no en el plan gratuito**, que da para diez chavales durante un mes: se prueba
  en gratis y se salta a Pro cuando entren jugadores de verdad.
- **Jefes por departamento.** En creativo no hay jerarquía: nadie manda sobre
  nadie. Sí hay grano —Izan y Lluís invitan, Loren y Pau no— y eso se modela con
  roles y permisos, no con jefes.

### 3. Permisos por roles: la app decide por permiso, no por «admin o diseñador»

**El plan, con cada tarea y su verificación, está en
`docs/superpowers/plans/2026-09-16-permisos-rbac.md`**; el diseño, en el §4 del
spec. Aquí, lo que cambia el estado y lo que no se deduce del código.

**Qué hay ahora (commits `8bdd39c` → `938cd88`, 2026-09-16 y 17):**

- Tres tablas nuevas —`roles`, `role_permissions`, `profile_roles`— y una
  columna `profiles.kind` (`AGENCIA` o `JUGADOR`). **Los tres roles son fijos**
  y los siembra la migración: Gestor creativo, Diseñador senior, Diseñador. No
  hay pantalla de roles, por decisión de Mario; si hay que cambiar uno, es otra
  migración. Los permisos que existen los dice el código (`lib/utils/access.ts`):
  `invitar_personal`, `invitar_jugadores`, `gestionar_roles`,
  `recibir_asignaciones`.
- Tres funciones para preguntar desde las políticas de la base
  (`has_permission`, `in_department`, `is_staff`) y una guardia: la base
  **impide dejar al equipo sin nadie que gestione roles**, tanto quitando el rol
  como borrando la cuenta.
- Las ocho personas migradas: los cuatro admin son Gestor creativo, los cuatro
  diseñadores son Diseñador. **Subir a Izan y Lluís a Diseñador senior lo hace
  Mario** desde Ajustes → Miembros, que ahora tiene un selector de rol. Está por
  hacer.
- La app entera decide por «cara» (mánager, diseñador, jugador) y por permiso;
  ya no compara con `ADMIN` ni `DESIGNER`. Las invitaciones llevan el rol del
  catálogo. Repartir lo puede cualquiera de creativo. La función de borrar
  cuentas pregunta por `gestionar_roles` (código en el repo; **se despliega con
  el merge**, la versión desplegada sigue valiendo hasta la 046).

**Tres migraciones, y por qué en tres.** Producción y preview comparten base, y
`main` todavía lee `profiles.role`. Así que: la **044 añade** (aplicada el
2026-09-16, registrada en Supabase como `roles_y_permisos`); la **045 cambia
las políticas** para que pregunten por permiso y cierra dos agujeros (aplicada
el 2026-09-17 con permiso expreso de Mario, registrada como
`politicas_por_permiso`); la **048 borra lo antiguo** —`profiles.role`,
`invitations.role`, `is_admin`, `role_enum`— y **solo puede ir después del
merge a `main`**, porque hasta entonces producción lee esas columnas. (El
número 046 lo ocupó la migración de jugadores, §4.)

**Los dos agujeros que cierra la 045.** El pendiente 8 (cualquiera con sesión
borraba cualquier diseño) y uno peor, encontrado el 2026-09-16 al inventariar la
base: **cualquier usuario podía cambiar su propio `role` e `is_dev`** con una
petición directa, porque tenía permiso de escritura sobre la fila entera. La 045
deja escribibles desde el cliente solo las columnas de perfil (nombre, avatar,
color, preferencias). **Cerrados los dos el 2026-09-17**, al aplicarla; se
comprobó con sesiones simuladas: una cuenta ajena no ve ni borra nada, Loren ve
diseños y perfiles pero no puede cambiarse el rol (permiso denegado en la
columna) y sí editar su alias, Mario ve invitaciones y auditoría, y ninguna
política mira ya el rol antiguo.

**Qué le pasó a producción al aplicar la 045:** nada, para las ocho personas —
se recorrió escritura a escritura y se comprobó antes que las 8 tenían rol. Lo
único que deja de funcionar en la versión antigua es «Cambiar rol» de Miembros,
hasta el merge. Y ojo para el futuro: **una cuenta de la agencia sin rol
asignado no ve nada** (ni diseños ni perfiles).

**Lo que se descubrió por el camino, para no volver a tropezar:**

- Sin tipos generados de Supabase, `from()` devuelve `any` y
  `.overrideTypes<>()` no compila (TS2347); la fila se anota a mano en el
  resultado. Con `rpc()` sí funciona.
- `profiles` tiene dos claves foráneas hacia `profile_roles`, así que el embed
  de PostgREST necesita el nombre de la FK:
  `profile_roles!profile_roles_profile_id_fkey(...)`. Está en
  `PROFILE_ROLES_EMBED`; no reescribirlo a mano.
- Revocar EXECUTE a `anon` sobre las funciones de permisos hace que una consulta
  anónima a `profiles` devuelva 401. La app nunca consulta sin sesión; se deja
  así a propósito.
- **Cómo se prueba la RLS de verdad:** simulando una sesión dentro de una
  transacción (`set local role authenticated` + `set_config('request.jwt.claims',
  …)`) y deshaciéndola. Las consultas están en el plan, tarea 9, paso 4. Buscar
  los uuid **antes** de cambiar de rol, o `auth.uid()` sale nulo.

**Lo que no se ha comprobado todavía:** la app en staging con ojos —crear una
invitación y ver el rol, cambiar un rol desde Miembros, repartir—. Lo automático
sí: tipos, lint, 178 tests y build en verde el 2026-09-17.

### 4. Jugadores, carpetas y almacén: los puntos 2, 3 y 4, en código

**El plan está en
`docs/superpowers/plans/2026-09-17-jugadores-carpetas-y-almacen.md`**, con las
decisiones que el spec dejaba abiertas (tablas, almacén, descarga, numeración).
Se hizo el 2026-09-17 con Mario fuera y todo delegado salvo producción. Aquí,
lo que cambia el estado.

**Qué hay ahora (commits `7d5941e` → `79bed90`):**

- **Sección «Jugadores»** para todo el departamento creativo (cuarta entrada de
  navegación): lista de fichas con cuenta y conteos, o con el enlace que
  caduca; ficha con cuenta, carpetas, «Nueva entrega» y zona avanzada
  (renombrar, activo, borrar); entrega con carpeta, rótulo y archivos tal cual;
  cada carpeta por lotes, y «Enviados por él» en lista; una hoja por archivo
  para ver, descargar el original, mover o eliminar.
- **El alta del jugador** reutiliza `/invite/[token]`: la invitación lleva
  ficha en vez de rol, la pantalla pone el nombre y pide un solo campo de
  apellidos y la contraseña dos veces, y la cuenta nace `JUGADOR` enganchada a
  esa ficha, sin roles.
- **El área personal de verdad** (`/area-personal`): portadas y conteos, subir
  desde el móvil (cae en «Enviados», y de ahí lo quita él mientras nadie lo
  coloque), cada carpeta por lotes con vista previa y descarga, y salir de
  sesión desde el avatar. Los datos inventados de la maqueta se borraron.
- **Cada clase de cuenta en su marco:** el middleware manda al futbolista a
  `/area-personal` y a la agencia fuera de ahí, con una consulta de perfil por
  navegación; los dos marcos lo repiten en cliente.
- **Migración 046** (`046_jugadores_y_archivos.sql`): `players`, `player_files`,
  `invitations.player_id`, `get_invitation_by_token` y `use_invitation` v3,
  `handle_new_user` v3, el cubo `jugadores` con sus cuatro reglas, y un valor
  `JUGADOR` en el enum antiguo `role_enum`. Comprobada en seco (dentro de una
  transacción deshecha, con las dos restricciones de ruta saltando) y
  **aplicada el 2026-09-17** después de la 045, con permiso expreso de Mario,
  registrada como `jugadores_y_archivos`. Sesiones simuladas: Mario crea una
  ficha y su enlace, Loren las ve, una cuenta ajena no ve ni crea nada, y el
  enlace se valida como anon con el nombre del jugador. **La que borra lo
  antiguo del rol pasa a ser la 048.**
- **Revisada con contexto limpio antes de aplicarse.** Sacó tres cosas
  serias, corregidas el mismo día: (1) un jugador podía crear una fila suya
  apuntando a un objeto ajeno y borrarlo con la regla del cubo — ahora la ruta
  va atada a la fila por restricción y la regla del cubo busca la fila por la
  ruta; (2) una cuenta de jugador nacía con `profiles.role = 'DESIGNER'`, y
  **`main` sí lee esa columna**: lo listaba en Equipo y le repartía diseños —
  ahora el enum tiene `JUGADOR`, el perfil nace así (el alta manda `kind` en
  los metadatos) y `use_invitation` lo confirma; (3) `use_invitation` se fiaba
  del `p_user_id` que le pasaban y con un enlace válido se podía degradar a
  JUGADOR cualquier cuenta de la agencia — ahora exige que sea la cuenta que
  llama o, sin sesión, un perfil recién nacido sin roles ni ficha. Y tres
  menores: el deshacer de una subida fallida no podía borrar objetos del
  jugador (ahora la fila se crea antes que los objetos), vaciar una ficha
  paraba en mil objetos (ahora pagina), y el alta con sesión inmediata dejaba
  un perfil viejo en el cliente (ahora cierra sesión y recarga). El informe
  entero está en el plan.

**El almacén (spec §9):** un cubo privado `jugadores`, 50 MB por archivo (el
techo del plan gratuito), imágenes y vídeos. Ruta `{player_id}/{file_id}.{ext}`
y miniatura `{player_id}/{file_id}.thumb.jpg`, hecha en el navegador al subir
(el plan gratuito no transforma imágenes; los vídeos van con icono). Las reglas
del cubo leen el jugador del primer tramo de la ruta. Descarga con URL firmada
de un minuto, en pestaña nueva (en iOS es lo que deja guardar en Fotos).

**Lo que hay que saber para no tropezar:**

- Todo el circuito —subir, mover, borrar— va del navegador a Supabase con la
  sesión de quien lo hace; la RLS del cubo y de `player_files` es la
  protección. **Borrar es objetos primero, fila después:** la regla del cubo
  comprueba que la fila siga sin colocar, así que al revés falla para el
  jugador.
- **Con sesión abierta, `/invite/…` redirige a casa.** Para probar el alta de
  jugador desde el mismo móvil hay que cerrar sesión o abrir el enlace en una
  pestaña privada, con otro correo.
- «Descargar las N» de la maqueta se quedó fuera (varias descargas seguidas se
  bloquean en iOS Safari; un zip en el navegador no cabía). Está en Abierto.
- **Lo que producción (`main`) ve de un jugador hasta el merge:** nada en
  Equipo ni en el reparto (gracias al valor `JUGADOR` en `role`), pero **sí una
  fila en Ajustes → Miembros**, porque esa lista de `main` enseña todos los
  perfiles; le pondrá una etiqueta de rol que no le corresponde. Es cosmético y
  solo lo ven los gestores; desaparece con el merge. Si molesta, el primer
  jugador de verdad espera al merge.
- Los lotes son un rótulo por archivo (`player_files.batch`), no una entidad:
  se agrupa por él y, sin él, por día.

**Lo que no se ha comprobado:** la app con datos reales de jugadores desde un
navegador o el iPhone. La base sí (sesiones simuladas de arriba) y lo
automático también, en cada fase: tipos, lint, 190 tests, build. **El recorrido
entero desde el iPhone** (crear ficha → enlace → alta con otro correo → subir →
mover → borrar) es el pendiente 12, junto con los retoques de fluidez.

### 5. La app se muda a Dublín (`9395c3f`, 2026-09-21)

**El síntoma:** «va muy lenta y tarda en cargar», en un iPhone de última
generación. **La medida** (curl contra staging con la sesión de Mario, el
2026-09-18): entre **1,3 y 3,5 segundos solo en empezar a responder**, antes
de descargar o pintar nada. La cabecera `x-vercel-id` decía `cdg1::iad1`: la
petición entraba por París y **la app se ejecutaba en Washington**, con la
base de datos en Irlanda (`eu-west-1`). Cada página hacía dos consultas a la
base desde el servidor —validar la sesión y leer el perfil para saber si la
cuenta es de agencia o de jugador— y cada una cruzaba el Atlántico ida y
vuelta. El teléfono no tenía nada que hacer: esperaba.

**Qué se hizo:**

- **`vercel.json` con `regions: ["dub1"]`.** Las funciones corren en Dublín,
  al lado de la base. Es lo único que hay en ese archivo; se decidió por
  archivo y no por panel para que viaje con el repo.
- **La clase de cuenta viaja en la sesión.** La migración 047
  (`kind_en_la_sesion`) copia `profiles.kind` a `app_metadata` de la cuenta
  (un trigger, y relleno de las ocho). `app_metadata` lo escribe solo la base
  —el usuario no puede tocarlo—, por eso vale para decidir acceso; Supabase lo
  devuelve con la sesión, así que el middleware ya no lee el perfil en cada
  navegación: solo en dos casos raros (entrar en `/login` con sesión, o pisar
  el marco equivocado), donde además necesita saber si la cara es de mánager
  o de diseñador.
- En una navegación dentro del panel queda **una** consulta: validar la sesión
  contra Supabase Auth (`getUser`) desde el middleware. En una **carga
  completa** (abrir la PWA, recargar) son tres: esa, más otro `getUser` y la
  lectura del perfil que hace el layout raíz en servidor (`getServerAuth`);
  el segundo `getUser` es el redundante, si algún día hay que rascar. Y un
  matiz de geografía que sacó la revisión: el middleware corre en el borde
  (el punto de entrada, París para Mario), no en Dublín, así que su `getUser`
  va de París a Irlanda; el del layout sí sale de Dublín. Quitar el del
  middleware del todo es posible con `getClaims`, que verifica el token en
  local sin llamar a nadie, **pero exige pasar el proyecto a claves de firma
  asimétricas** (hoy usa la clave simétrica antigua; el endpoint JWKS devuelve
  `{"keys":[]}`). Es un cambio en el panel de Supabase con rotación de claves:
  se hará aparte, con Mario delante, si sigue haciendo falta.
- **Revisado con contexto limpio el mismo día.** Dos cosas corregidas en el
  commit siguiente: (1) si la sesión y el perfil discrepan sobre la clase de
  cuenta (claim sin poner, editado a mano), el middleware rebotaba sin fin
  entre `/area-personal` y sí mismo; ahora, cuando ya ha leído el perfil,
  manda el perfil. (2) **Venía de antes:** sin cookie, `getUser` devuelve un
  error de «sesión ausente» y el middleware lo trataba como fallo y servía la
  página protegida entera al anónimo (comprobado: `curl` sin cookies a
  `/inicio` daba 200); ahora «sin sesión» es sin sesión y va a `/login` en
  servidor. Y la 047 se hizo reaplicable. Lo que la revisión no pudo
  comprobar: un alta real de jugador (el trigger 047 aún no ha corrido en un
  alta; tras la primera, `select raw_app_meta_data->>'kind' from auth.users
  where id = …` debe decir `JUGADOR`).

**Resultado, medido igual el 2026-09-21 contra el despliegue del `9395c3f`:**
`x-vercel-id: cdg1::dub1` (la app corre en Dublín) y el servidor empieza a
responder en **0,4–0,9 s** (nueve peticiones a `/inicio`, `/jugadores` y
`/disenos`, tres pasadas), frente a 1,3–3,5 s antes. Lo que queda de ese
tiempo es la validación de la sesión (una llamada a Supabase Auth) más el
render; para bajarlo más, `getClaims` (arriba). Falta que Mario lo note en el
iPhone: lo medido es el servidor, no el pintado en el teléfono.

**Y en el teléfono, que era donde de verdad se iba el tiempo (`7f4e6bd`).**
Mario no notó la mudanza, así que se cronometró el arranque con el perfil de
iPhone contra el build de producción en local (script en el scratchpad de la
sesión; la receta cabe aquí: Playwright + WebKit + `devices['iPhone 15']` +
la sesión guardada, anotando cada petición y cuándo aparece el contenido).
Dos hallazgos, los dos de la app y no de la red:

- **El esqueleto tardaba ~600 ms en irse.** `PageTransition` usa
  `AnimatePresence mode="wait"`: el contenido no se monta hasta que el
  esqueleto termina su salida, y la salida iba con el mismo muelle «gentle»
  que la entrada, que tarda ~600 ms en asentarse aunque el recorrido sea de
  4 px. Medido: datos de Jugadores a los 330 ms, contenido a los 970. La
  salida pasa al tween rápido (120 ms); la entrada conserva el muelle.
  **Afecta a todas las páginas.**
- **Inicio pedía la lista de diseñadores tarde:** solo cuando el dashboard se
  montaba, es decir, después de los diseños y del esqueleto. Ahora la página
  la pide desde el principio, en paralelo (SWR la comparte por clave).

Resultado en local (misma máquina, misma red; sirve para comparar, no como
cifra absoluta): **Inicio en frío de 2,5 s a 0,85 s**; primera visita a
Jugadores de 970 a 440 ms; **entre pestañas ya visitadas, 40–70 ms**. Lo que
queda de la primera visita a cada pestaña es descargar su código y pedir sus
datos; Diseños es la más pesada (850 ms) porque carga el calendario. Y en el
iPhone, además, cada consulta a Supabase sale del teléfono hacia Irlanda
(~100 ms cada una): Inicio hace cinco.

**Lo que se descartó:** el *custom access token hook* de Supabase (meter el
`kind` en el token al emitirlo). Habría servido igual, pero hay que activarlo
a mano en el panel y el token tarda hasta una hora en refrescarse; con
`getUser` el `app_metadata` llega siempre fresco y no hay nada que activar.

**Lo que hay que saber:** el conector de Vercel de Claude Code **no ve el
proyecto** aunque Mario lo transfirió a su cuenta: ve el equipo `rodz-dev`
vacío, y el despliegue `phsport-…-rodz-dev.vercel.app` le devuelve «no
encontrado». Es un permiso de la aplicación conectada, no del proyecto
(`vercel.com/account/authentication` → *Connected Applications*). Mientras
tanto, la región se lee de la cabecera `x-vercel-id` de cualquier respuesta,
y los despliegues se localizan por la API de GitHub (`deployments` del commit).

---

## Qué queda pendiente

### 1. Confirmar `ANTHROPIC_API_KEY` en Vercel (Production)

Sin ella el chat de creación de diseños **no falla, pero no funciona**: la ruta
`/api/designs/chat` devuelve `200` con `{ fallback: true, reason: 'sin_api_key' }`
y el agente no responde. Degrada limpio, que es lo que permitió publicar sin
confirmarla, pero significa que puede estar apagada en producción sin que salte
ninguna alarma. Es lo primero que hay que mirar del despliegue del 22 de agosto.

No se puede comprobar desde aquí: el MCP de Vercel solo ve el proyecto del repo
antiguo. Hay que entrar al panel.

### 2. Una cuenta de pruebas

Los tests de navegador que necesitan sesión se saltan si no hay credenciales:

```bash
PLAYWRIGHT_USER=… PLAYWRIGHT_PASS=… npm run e2e
```

Hasta ahora se han ejecutado con la cuenta real de Mario, que es de mánager, con
`is_dev`, y apunta a **producción**. Los tests actuales solo leen. En cuanto haya
alguno que cree o borre diseños, hace falta una cuenta aparte.

### 3. Los «retoquillos» del rediseño, sin concretar

Mario validó el rediseño completo en iPhone el 2026-08-21 y le convence: eso es
lo que desbloqueó el despliegue. Quedan **ajustes menores que él vio y que no
están anotados todavía** — hay que pedírselos antes de tocar nada, porque
adivinarlos es la vía rápida a cambiar lo que no molestaba.

Si alguno es el fundido de la tab bar, recordar que la cantidad es un número
—`6.5rem`— y que vive **en dos archivos acoplados**: cambiar uno sin el otro
deja la última fila del scroll atenuada.

Lo que sigue sin rodaje en el día a día: el aviso de semanas futuras y el chat
de creación de diseños. El chat, además, no se puede usar en producción hasta
confirmar su clave (pendiente 1).

### 4. Las otras 14 funciones con el `search_path` entrecomillado

Mismo defecto que tumbó `validate_invitation` (§8), pero hoy inofensivo: todas
cualifican sus tablas con `public.`. La lista sale de un vistazo:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%,%');
```

Entre ellas están `handle_new_user`, `is_admin` y toda la tubería de
notificaciones, así que no es una limpieza cosmética: si una se toca sin cuidado
y pierde un `public.`, se cae en silencio igual que se cayó el alta. El arreglo
es mecánico —`SET search_path = ''` y cualificar— pero toca funciones vivas y
merece su propia tanda con verificación una por una, no ir de paso.

**Avance (2026-09-17):** `handle_new_user` queda arreglada en la 045 (reescrita
con `search_path = ''`), e `is_admin` desaparece en la 046, cuando ya no la use
ninguna política. Quedan las otras doce.

### 5. `invitations.role` y `profiles.role` no comparten tipo — HECHO el 2026-09-16

**Resuelto por otro camino:** desde la 044 la invitación lleva `role_id`, una
clave hacia la tabla `roles`, y `use_invitation` concede ese rol. Las dos
columnas de texto siguen existiendo solo para que `main` no se caiga; la 046 las
borra. Lo de abajo queda como estaba, para entender el porqué.

La primera es `text`, la segunda es `public.role_enum`. Eso es lo que tumbó
`use_invitation` (§10), y el cast de la `043` lo tapa sin resolverlo: las dos
columnas representan lo mismo y deberían ser el mismo tipo.

Convertir `invitations.role` a `role_enum` es lo correcto, pero toca el diálogo
de crear invitación y el esquema zod de la API, así que no es un `ALTER` suelto.
Mientras tanto, el cast protege: un valor que no sea `ADMIN` o `DESIGNER` hace
fallar el alta en vez de colar un rol inventado.

### 6. Modo debug para cuentas de desarrollador

**En espera desde el 2026-07-13**, con el análisis hecho y una pregunta sin
responder. Se anota aquí porque hasta hoy vivía solo en la memoria local de una
máquina, y volver a derivarlo cuesta una sesión entera.

**La motivación:** el conmutador «Ver como» se queda corto para probar la app de
verdad. No hay forma de disparar una notificación a demanda, por ejemplo.

**El matiz que lo cambia todo:** «Ver como» es un **disfraz de solo frontend**.
Inyecta la identidad fingida en el contexto de React, pero **la sesión real
sigue siendo la de administrador**: el servidor y las políticas de la base te
siguen viendo como admin. Sirve para *mirar* la interfaz de un diseñador, **no**
para probar permisos. Cualquier cosa que se construya encima debe ir con doble
cerrojo —el indicador en la base **y** una comprobación en servidor—, nunca
fiándose del cliente.

**Lo que ya se exploró, para no repetirlo:** el indicador de desarrollador vive
en el perfil desde la migración 035; ya hay un patrón probado de superficie que
solo se dibuja para esas cuentas, y se reutilizaría tal cual. Las notificaciones
se insertan restringidas a admin, llegan solas por realtime filtrado por usuario,
y las crean disparadores de base de datos más una ruta de alta en lote.

**El menú de capacidades que se barajó**, de más a menos valor por esfuerzo:

1. **Banco de pruebas de notificaciones** — un formulario que inserta una
   notificación y llega al instante por el canal que ya existe. Es el que
   resuelve el dolor concreto y el más barato.
2. Disparar también el correo y el push desde ese mismo envío.
3. Inspector de estado: identidad efectiva, indicadores, entorno, versión, caché.
4. Simular eventos de dominio («listo para revisar», «entrega cerca»).
5. Semilla y borrado de datos de prueba.

**La pregunta de alcance, sin responder:** ¿solo el banco de notificaciones
(recomendado: resuelve el problema real, riesgo bajo, y crece después), o una
cabina de desarrollador completa de una vez? Retomar por ahí.

### 7. Un sistema de ayuda para toda la app — HECHO el 2026-09-08

Estuvo anotado y aparcado desde el 2026-07-02. **Ya no está pendiente:** se
publicó el 2026-09-08 y está contado arriba, en «Qué se hizo en septiembre». El
hueco se conserva con su número porque la cabecera de este documento apunta a
«§6 y §7».

**Cómo se respondieron sus tres preguntas abiertas**, que es lo que aquella nota
pedía resolver antes de tocar código:

- *¿Panel permanente, avisos en contexto, o ambos?* Ambos, con reparto: los avisos
  aparecen solo en la situación que confunde, y la página `/ayuda` es la lectura
  con calma. Ninguno de los dos sale «al entrar en la sección».
- *¿Convive con la ayuda contextual que ya existe o la sustituye?* Convive. Lo
  que existía eran tooltips `Hint` de una línea, que nombran un control; el
  sistema nuevo explica conceptos y funciona al tacto.
- *¿Hay bastantes puntos de fricción identificados?* Sí, y no hizo falta esperar
  a producción: estaban en este mismo documento. El caso de Lluís (§1 de agosto)
  es el consejo principal.

### 8. Cualquiera con sesión puede borrar cualquier diseño — HECHO el 2026-09-17

**Cerrado por la migración 045**, aplicada ese día: solo el departamento
creativo toca `designs`, y de paso se cerró el agujero de `profiles.role` del
§3 de septiembre. Comprobado con una sesión simulada de una cuenta ajena: ve 0
diseños y borra 0. Lo de abajo queda como estaba, para entender el porqué.

**Comprobado contra la base el 2026-09-14**, no deducido: la política de borrado
de `designs` es `auth.uid() IS NOT NULL`. Lo mismo crear y editar. El rol no
interviene.

- **Entrada:** un usuario con sesión llama a la API de Supabase con un DELETE
  sobre `designs`.
- **Esperado:** rechazado si no le corresponde.
- **Real:** borrado.

**Hoy es inofensivo y por eso lleva ahí desde el principio:** sois ocho, todos
del equipo. **Deja de serlo en cuanto entre el primer futbolista**, que es gente
de fuera con sesión en la misma app. La interfaz no le enseñaría el botón, pero
esconder un menú no es proteger un dato.

**Va antes que dar de alta a nadie de fuera.** Y arrastra el pendiente 4: las dos
funciones que hay que tocar —`is_admin` y `handle_new_user`— siguen con el
`search_path` entrecomillado, así que o se arregla a la vez o se caen en
silencio como se cayó el alta por invitación.

### 9. Línea base de migraciones antes de estrenar las ramas de base de datos

**PRIORITARIO en cuanto se pase a Pro: es lo primero que se hace, antes de
activar ninguna rama.** Anotado el 2026-09-17 a petición de Mario, que lo
marcó así expresamente. El salto a Supabase Pro trae las
ramas de base de datos —el entorno de pruebas que este proyecto nunca ha
tenido— y Supabase construye cada rama **reproduciendo `supabase/migrations`
de cero, en orden**. Tal como está la carpeta, esa reproducción fallaría:

- Números duplicados (`036` ×2, `037` ×2).
- Migraciones aplicadas a mano que no constan en el registro, y registros con
  nombre distinto al archivo (la base guarda `fix_use_invitation_role_cast`,
  el archivo se llama `043_…`).
- Nadie ha replayado nunca la carpeta contra una base vacía.

**Qué hacer, y cuándo:** justo antes de activar las ramas, volcar el esquema
real de producción a una sola migración de línea base (`supabase db dump
--schema-only`, o el equivalente por MCP), archivar las 4x anteriores en el
historial de git y comprobar que la carpeta nueva reproduce una base vacía
hasta el estado de producción. **No antes:** hoy no cambiaría nada en
producción y borraría de la carpeta los comentarios que documentan por qué se
rompió el alta (042, 043); esos porqués deben pasar a este documento antes de
archivar.

Hasta entonces, seguir añadiendo en orden (044 → 045 → 046) y registrar cada
una por MCP con el nombre sin prefijo, que es como están las últimas.

### 10. Ideas anotadas, sin decidir

- **Llevar el aviso de semanas futuras a Diseños.** Hoy solo está en Inicio.
  Requiere pensar dónde: esa página no tiene subtítulo y la semana vive en dos
  `DatePicker`.
- **El ritmo del punto con haz.** Late mientras haya trabajo detrás. Si cansa, se
  ralentiza con una clase o se le dan unos pocos latidos.
- **Desvanecer el título grande al acercarse a la barra**, como hace iOS, en vez
  de dejar que se meta debajo. **Ojo, no confundir con el fundido de la tab bar
  (§6), que ya está hecho:** aquel apaga el contenido contra el borde *inferior*;
  esto es el borde *superior*, y sigue sin hacerse.
- **Instalar Xcode** para probar iOS real (18 y 26) sin depender del móvil de
  Mario. No está instalado; se maneja con `xcrun simctl`, no con Playwright.

### 11. Aplicar la 048 tras el merge a `main` (la 045, la 046 y la 047 ya están)

**La 045 y la 046 se aplicaron el 2026-09-17** por MCP, registradas como
`politicas_por_permiso` y `jugadores_y_archivos`, con permiso expreso de Mario
(el modo automático de permisos las había bloqueado por la mañana; no se rodeó:
se esperó a que él lo dijera). Antes se comprobó que los 8 perfiles tenían rol;
después, sesiones simuladas para las dos (§3 y §4 de septiembre). **La 047**
(`kind_en_la_sesion`) se aplicó el 2026-09-21 con el mismo permiso: solo añade
un trigger y rellena `app_metadata` de las ocho cuentas (§5 de septiembre).

**Lo que queda es la 048, y va después del merge**, cuando Vercel tenga
desplegado en producción el código de `preview`: borra `profiles.role`,
`invitations.role`, `is_admin` y `role_enum` (con su valor `JUGADOR` de la 046).
Está descrita en el plan de permisos, tarea 11 (allí se llamaba 046; el número
lo ocupó la de jugadores), con el relleno previo de `invitations.role_id` para
las invitaciones antiguas. Aplicarla antes tumba producción. Con el merge va
también el despliegue de la función de borrar cuentas (`admin-delete-user`),
cuyo código ya está en el repo.

### 12. Rodar jugadores en el iPhone y pulir la fluidez

Mario recorrió `preview` el 2026-09-17 (antes de que existieran las tablas de
jugadores) y señaló tres cosas, **las tres atendidas ese mismo día** (commit
siguiente al `5529cc5`):

- **La banda clara sobre la cabecera** en el iPhone (PWA instalada).
  **Resuelta el 2026-09-21 (`842993e`), confirmada por Mario.** Seis pasadas;
  el detalle, en «Cosas que conviene saber». En corto: (1) sin fondo en
  `html`, Safari 26 pintaba blanco la barra de estado — arreglado el 18; (2)
  seguía «parte de la barra borrosa»: un contorno fucsia de diagnóstico y las
  capturas de Mario demostraron un velo de cristal de iOS 26 que baja ~24 px
  y desenfoca lo que pilla (la burbuja del avatar, medido píxel a píxel); (3)
  bajar la cabecera 24 px lo escondía, a costa de espacio; (4) un empujón de
  scroll al arrancar no hizo nada; (5) un hilo de 1 px con fondo antes de la
  cabecera, tampoco; (6) **Mario dio la pista** —el velo desaparece justo
  cuando la cabecera se vuelve opaca al desplazar— y la cabecera pasa a
  llevar el color de la página **al 2 %** arriba del todo: invisible, pero
  para iOS «tiene fondo».
- **El perfil se abre en una hoja desde abajo en móvil** (`cccb72c`), la
  misma pieza que Notificaciones (asa, arrastrar o tocar fuera para cerrar),
  a petición de Mario: nombre, correo y rol arriba; Ajustes, Miembros, Ayuda;
  «Ver como» plegable para cuentas dev; Cerrar sesión. En escritorio el
  desplegable no cambia.
- **Iconos junto al título** en las pantallas de Jugadores: fuera, como en el
  resto de la app (criterio de hace tiempo: título desnudo).
- **Navegación plana y brusca:** las pantallas de Jugadores entran ahora como
  Ajustes y Equipo (bloques que se asientan uno detrás de otro), los botones
  del enlace y el panel de mover se despliegan con la extensión suave de la
  app, las filas de una entrega entran y salen con fundido y se recolocan con
  muelle, y las miniaturas y portadas se funden al cargar en vez de saltar.

Para revisarlo con navegador hay credenciales en `.env.local` como
`USER_EMAIL` / `USER_PASSWORD` (Mario, 2026-09-17); el setup de e2e espera
`PLAYWRIGHT_USER` / `PLAYWRIGHT_PASS`, así que se lanzan mapeadas:
`set -a; source .env.local; set +a; PLAYWRIGHT_USER="$USER_EMAIL"
PLAYWRIGHT_PASS="$USER_PASSWORD" npx playwright test --project=sesion`, y luego
`npx playwright screenshot --browser=webkit --device="iPhone 15"
--load-storage=e2e/.sesion/usuario.json <url> <png>` contra `next start -p 3100`.
Es la cuenta de Mario (gestor): mira y crea datos de prueba que luego hay que
borrar (hoy existe la ficha «Juan Cruz», sin cuenta, creada por él).

**El 2026-09-21 Mario amplió la lista** al volver tras unos días: la banda
sigue; en Jugadores nota una tipografía distinta y le falta pulido; las
animaciones no se le notan; y, sobre todo, **la app va lenta incluso en un
iPhone de última generación**. El rendimiento se atacó primero (§5 de
septiembre), porque sobre una app que va a tirones nada parece fluido.

**Queda, en este orden:**

1. ~~La banda de la cabecera.~~ Resuelta y confirmada por Mario el 2026-09-21.
2. ~~Medir el rendimiento tras la mudanza a Dublín; si sigue lenta, el
   siguiente escalón es el arranque en el propio teléfono.~~ Hecho el mismo
   día (§5): el esqueleto se iba con muelle y retenía el contenido medio
   segundo en cada página; Inicio pedía tarde a los diseñadores. Falta que
   Mario lo note en la PWA; si aún no, lo siguiente es el código que se
   descarga (Diseños carga el calendario, 333 kB) y el segundo `getUser` del
   layout raíz.
3. ~~Pulido de Jugadores: la fuente monoespaciada solo para cifras y fechas.~~
   Hecho (`c208bcf`): las frases van en la fuente normal; la mono queda en
   iniciales, fechas y tamaños, como en Equipo. Queda la pasada pantalla a
   pantalla contra Ajustes y Equipo si Mario ve algo más.
4. Transiciones entre páginas (entrar en una ficha desliza, volver retira,
   las pestañas se funden): hoy Next cambia de pantalla de golpe y el
   movimiento que hay es solo dentro de cada página.
5. El recorrido entero de jugadores desde el iPhone (crear ficha → enlace →
   alta con otro correo, sin sesión abierta → subir desde el móvil → mover,
   entregar, borrar desde la agencia). **Anotado el 2026-09-21 como pendiente
   a petición de Mario**; sin fecha. Después, decidir el merge (pendiente
   11), que Mario quiere que espere.

---

## Cosas que conviene saber y no se deducen del código

- **El fundido de la tab bar y el `pb` del contenido van acoplados.** Los dos
  valen `6.5rem`: la altura del degradado en `mobile-tab-bar.tsx` y el
  `pb-[calc(env(safe-area-inset-bottom)+6.5rem)]` de `page-container.tsx`. Si el
  contenido termina **dentro** de la franja del degradado, la última fila se lee
  atenuada al llegar al final del scroll. Cambiar uno obliga a cambiar el otro;
  está comentado en ambos archivos.
- **Safari 26 ya no lee `theme-color`.** Tinta su barra muestreando el fondo de
  los elementos fijos o pegajosos cercanos al borde, incluso si tienen
  `opacity: 0`. El `themeColor` de `app/layout.tsx` no hace nada en iOS 26. Si
  aparece un tinte raro, mirar ahí. **Y si el elemento pegado no tiene fondo**
  (la cabecera, transparente arriba del todo), cae al fondo de `html`; sin él,
  pinta una **banda blanca** sobre la cabecera, más clara que la página, que
  Mario vio el 2026-09-17 tocando el título, la campana y el avatar. Desde ese
  día `html` lleva el mismo fondo que `body` (`app/globals.css`): la banda
  sigue ahí, pero del color de la página. No se puede reproducir con el WebKit
  de escritorio de Playwright; solo en un iPhone con iOS 26.
- **Y en la app instalada, iOS 26 además pinta un velo de cristal** desde la
  barra de estado hacia abajo (~24 px, se desvanece) **cuando la cabecera
  —el elemento pegado al borde superior— es transparente**; con cualquier
  fondo, aunque sea al 2 %, usa borde duro y no hay velo. Por eso la cabecera
  lleva `bg-background/[0.02]` arriba del todo (`header.tsx`): invisible, el
  título se ve a través, y iOS contento. Lo que NO funcionó, para no
  repetirlo: reservar 24 px de hueco (funciona pero cuesta espacio), un scroll
  de 1 px al arrancar (no era la causa) y un elemento sticky de 1 px con fondo
  antes de la cabecera (iOS mira a la cabecera, no a un hilo). Cómo se midió:
  muestrear una captura del iPhone columna a columna (script de Node que
  decodifica el PNG) y ver el color del avatar aclararse hacia arriba. No se
  reproduce con el WebKit de Playwright.
- **Los dos «2ª PORTUGAL - J2» no son un duplicado**: son dos piezas del mismo
  partido, para jugadores distintos. El modelo lo permite y es correcto.
- **Lo que hay detrás de la app —cuentas, claves, correo, DNS— está en
  `docs/operaciones-y-entorno.md`.** Ahí viven las dos cosas que más tiempo han
  costado y que no se deducen del código: que hay **dos emisores de correo
  independientes**, y que el proyecto de Vercel que se ve desde las herramientas
  **no es el que despliega**.
- **Aviso retirado el 2026-09-07:** este documento decía que el README estaba
  desactualizado en un apartado de «Comunicaciones». Ya no lo está —ese apartado
  no existe—, así que la nota se quedó mintiendo ella. Queda escrito porque es el
  fallo típico de esta clase de avisos: envejecen antes que aquello que señalan.
