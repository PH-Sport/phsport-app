# Estado del proyecto y traspaso

> **Actualizado:** 2026-09-08, al publicar el sistema de consejos y la sección
> de Ayuda (ver más abajo). Antes, el 2026-09-07, al preparar el salto a otro
> equipo. Lo de fondo
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

**Las dos van a la par desde el 2026-08-22.** Ese día se subieron
a producción los 95 commits que llevaban meses acumulados: el rediseño iOS 26
entero, la fase 1.5 de contenido y voz, el chat de creación de diseños y los
arreglos del alta por invitación. Fue un fast-forward limpio, sin merge commit.

**El flujo de ramas ya está por escrito** en `CLAUDE.md`, apartado «Ramas»: se
implementa en `preview` y `main` solo recibe lo probado. Hasta ahora era un
acuerdo tácito y no constaba en ningún sitio.

### Cuidado: la base de datos va por delante del código

**Ya no lo va: con el despliegue del 2026-08-22 se han igualado.** Se deja escrito
porque explica por qué tres migraciones del repo no hay que ejecutarlas nunca.

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

### 5. `invitations.role` y `profiles.role` no comparten tipo

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

### 8. Ideas anotadas, sin decidir

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
  aparece un tinte raro, mirar ahí.
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
