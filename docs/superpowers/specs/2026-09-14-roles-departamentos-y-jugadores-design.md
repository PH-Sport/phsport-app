# Departamentos, permisos y el área del futbolista

**Fecha:** 2026-09-14; los cuatro puntos del orden de trabajo, confirmados por Mario el 2026-09-16
**Estado:** decisiones cerradas; nada implementado salvo una vista previa. Este documento es la guía para completar los cuatro puntos.
**Alcance:** la primera fase del salto de «panel del equipo de diseño» a «app de la agencia».

---

## Por qué existe este documento

PHSPORT deja de ser el panel del equipo de diseño. Lo que hay hoy pasará a ser
**una sección más** —la de los perfiles creativos: diseñadores, fotógrafos,
marketing— y encima se añaden secciones por departamento:

- **Agentes y scouts.** El campograma, hoy en otro repositorio, más lo que salga
  del brainstorming. Sin organizar todavía.
- **Futbolistas representados.** Su área personal. Es lo único de esta fase que
  está claro, y por eso se ataca primero.

La diferencia de fondo con todo lo anterior: **entra gente de fuera**. Hasta hoy
todos los usuarios son del equipo y se fían entre sí; un futbolista no lo es.
Varias decisiones vigentes se tomaron asumiendo lo primero y dejan de sostenerse
con lo segundo (ver §«Lo que hay que arreglar antes»).

---

## Lo decidido

### 1. El futbolista entra por la misma app, con marco propio

Mismo inicio de sesión y misma base, pero su propia zona: `app/(jugador)/`, con
su layout, sin barra lateral, sin cabecera y sin tab bar.

**Por qué así y no de las otras dos formas que se barajaron.** Una aplicación
separada haría imposible por construcción que un futbolista vea el panel
interno, pero son dos frontales que mantener para siempre y aquí hay una sola
persona en la parte técnica. Meterlo como un departamento más del panel era lo
más rápido, pero esconder un menú no es protegerlo, y la regla que de verdad
hace falta —«cada uno ve lo suyo»— no es una regla de departamento.

**No es un patrón nuevo:** `(auth)` y `(dashboard)` ya son grupos con layouts
distintos. `(jugador)` es el tercero.

### 2. Los departamentos van en su propia tabla, no en una casilla del perfil

Una persona puede estar en varios. Mario es creativo y, el día que lleve chicos,
también agente; un fotógrafo puede tocar marketing.

Con una casilla única habría que elegirle a cada uno un departamento «principal»
y tapar el resto con excepciones — y las excepciones son lo que hace que dentro
de un año nadie se atreva a tocar los permisos. Con tabla aparte, crear
«scouting» es añadir filas y no toca la ficha de nadie.

**Cómo acabó:** la «hoja de pertenencias» no existe como tabla propia. La
absorbió el modelo de roles del §4 — cada rol lleva su departamento, así que
tener el rol «Diseñador» *es* estar en creativo. La decisión de fondo (varios
departamentos por persona, sin casilla única) se mantiene intacta.

### 3. Dentro de un departamento no hay jerarquía

Esto **corrige** el primer planteamiento, que asumía jefes y subordinados. En
creativo no los hay: hay gente que normalmente sube y asigna diseños, y gente
que normalmente los hace, pero **ninguno puede menos que otro**. Si a Jota se le
olvida subir un diseño lo sube cualquiera, y dos diseñadores se intercambian
trabajo entre ellos sin pedir permiso a nadie.

**Matiz que llegó después:** no hay jerarquía, pero sí hay grano. Izan y Lluís
pueden invitar gente; Loren y Pau, no. Eso no es «mandar sobre alguien» —nadie
manda sobre nadie—, es tener una llave más. Lo que se descarta es el escalafón,
no la diferencia de permisos. Cómo se modela, en el §4.

### 4. Permisos: roles con permisos, y pocos

**Esto sustituye a un planteamiento intermedio** de «dos casillas» por persona
(recibe trabajo sí/no, administra sí/no) que se quedó corto en cuanto salió el
dato real: Izan y Lluís pueden invitar gente y Loren y Pau no. **Hay grano dentro
del departamento aunque no haya jerarquía**, y dos casillas no lo expresan.

Lo profesional para esto es **RBAC** (control de acceso basado en roles): el
usuario tiene roles, el rol tiene permisos. Tres capas, y cada una la mantiene
quien debe:

| Capa | Quién la define | Dónde vive |
|---|---|---|
| **Permisos** — acciones concretas | El código; nadie los edita | Constante en código |
| **Roles** — nombre, departamento, permisos | Nosotros, por migración (fijos, sin pantalla) | Tabla |
| **Persona ↔ roles** — con quién lo asignó y cuándo | La agencia, desde Ajustes → Miembros | Tabla |

**El rol lleva el departamento.** Tener «Diseñador» es estar en creativo; tener
«Agente» es estar en agentes. Mario tendrá los dos cuando lleve chicos.

**`AGENCIA` o `JUGADOR` va aparte**, como barrera dura en el perfil: un jugador
no tiene roles, y punto. Es la única distinción de seguridad que conviene tener
en una casilla fácil de comprobar.

#### Con qué se arranca

Cuatro permisos y tres roles. **Ni uno más hasta que aparezca la acción que lo
necesite** — el modelo aguanta que crezca; lo que no aguanta bien es nacer
inflado.

```
Permisos:  invitar_personal · invitar_jugadores · gestionar_roles · recibir_asignaciones

Gestor creativo    creativo   invitar_personal · invitar_jugadores · gestionar_roles
Diseñador senior   creativo   invitar_personal · invitar_jugadores · recibir_asignaciones
Diseñador          creativo   invitar_jugadores · recibir_asignaciones
```

(«Diseñador» lleva `invitar_jugadores` porque el §8 lo da a todo creativo; la
primera versión de esta tabla lo omitía y se corrigió el 2026-09-16.)

Y el equipo actual, tal como está en la base el 2026-09-16:

| Persona | Hoy | Pasa a |
|---|---|---|
| Mario, Diego, Eva, Jota | `ADMIN` | Gestor creativo |
| Izan, Lluís | `DESIGNER` | Diseñador senior |
| Loren, Pau | `DESIGNER` | Diseñador |

Confirmado con Mario: ningún admin recibe diseños; invitar gente lo pueden hacer
los cuatro admin más Izan y Lluís.

#### De dónde sale, y es lo importante

No de un diseño teórico, sino de mirar qué hace hoy el rol de verdad. `DESIGNER`
aparece en cinco sitios del servidor y **cuatro son «dame la lista de gente a la
que asignar trabajo»**, no un permiso. El único permiso real es repartir en lote.
En la base, la tabla de diseños deja leer, crear, editar y borrar a cualquiera
con sesión: el rol no pinta nada ahí.

Es decir, `profiles.role` lleva desde el principio haciendo de «quién entra en
el reparto» disfrazado de permiso. Por eso `recibir_asignaciones` es un permiso
más y no un atributo aparte: es lo que el rol ya era.

#### Lo que lo hace de primera, y no un parche

1. **Se comprueba en la base, no en la pantalla.** Una función
   `has_permission(usuario, permiso)` que usan las políticas de seguridad y el
   servidor. Una sola fuente de verdad; esconder un botón deja de ser la
   protección.
2. **Cambiar un rol cambia a todos los que lo tienen.** Una fila, no seis
   personas.
3. **Añadir un permiso no migra datos.** Una línea de código y una fila en el
   rol que toque.
4. **Auditable.** Quién dio qué rol a quién y cuándo; la app ya tiene registro
   de auditoría y se le engancha.
5. **Aguanta 150 jugadores y 30 empleados** sin marcar casillas persona a
   persona.

**Es como los roles de Discord**, y así lo entiende Mario: un rol tiene nombre y
una lista de permisos con sí o no, y a la persona se le da el rol. Lo que no se
copia son las excepciones por persona: con cuarenta permisos por cabeza, en
creativo todas dirían que sí para casi todos, y cada casilla es un sitio donde
equivocarse.

**Coste, sin adornos:** tres tablas nuevas, una función en la base, reescribir
las nueve políticas que hoy miran el rol, y un selector en Ajustes → Miembros
para elegir el rol de cada compañero. Es la tanda grande de esta fase, y el
cimiento de agentes, scouts y jugadores a la vez.

**Implementado el 2026-09-17** (migraciones 044 y 045 aplicadas; plan en
`docs/superpowers/plans/2026-09-16-permisos-rbac.md`; estado en el §3 de
septiembre de `docs/estado-y-traspaso.md`). La 048, que borra lo antiguo,
espera al merge a `main`.

**Consecuencia de no tener escalafón:** quien puede invitar puede invitar a
cualquier rol, y quien gestiona roles puede dar cualquier permiso. No hay «por
encima de». Con ocho personas de confianza es lo correcto; si algún día hace
falta, la regla sería «no puedes dar lo que no tienes» y cabe en una función.

**Los roles son fijos** (Mario, 2026-09-16, al ver las pantallas): no hay
pantalla para crear roles ni para marcar sus permisos. Los tres los define este
documento y los siembra una migración; si algún día hay que cambiar uno, se
cambia aquí y en otra migración. Evita una pantalla llena de ajustes que nadie
va a tocar. En la pantalla, un rol por persona (un selector); la tabla admite
varios para cuando lleguen los agentes.

#### Lo que NO necesita el modelo de roles

**Que los departamentos estén todos definidos.** Un departamento nuevo es un rol
más; sus acciones, permisos más. Agentes se añade cuando toque, sin tocar esto.

**Quién lleva a cada jugador.** Los agentes ven toda la cartera. Más adelante
—sin prisa, dicho por Mario— se indicará el agente responsable de cada chaval
(«Juan Cruz — Diego Hernansanz»). Eso **no es un permiso**: es una relación
entre un agente y unos jugadores concretos, el mismo patrón que «Dani ve su
carpeta y no la de Iker». Roles para las acciones, «es tuyo» para los datos. Los
dos conviven sin tocarse.

### 5. El área personal del futbolista: un «mini Drive» donde él no organiza

Dos direcciones:

- **De la agencia al chaval** — fotos seleccionadas, matchdays. Él descarga.
- **Del chaval a la agencia** — material que manda. Sube y ya.

**Las carpetas las pone la agencia** y son las mismas para todos. Él no crea, no
mueve, no renombra. Lo que él sube cae en «Enviados» y puede quitarlo mientras
esté ahí.

**Lo que él sube es de la agencia desde el primer momento** (dicho por Mario el
2026-09-16): nada más entrar, alguien de creativo puede moverlo a una carpeta o
eliminarlo, sin esperar a nada. Si manda un vídeo que vale para Matchdays, se
mueve ahí y se queda como una entrega más — y entonces ya no lo puede quitar
él. Es la única diferencia con un Drive de verdad: el archivador lo lleva la
agencia, y él solo mete cosas por la ranura.

**Consecuencia para el modelo:** una entrega y un envío son **la misma clase de
archivo**, con un campo que dice quién lo subió y otro que dice en qué carpeta
está. «Enviados» no es una tabla aparte: es «archivos de este jugador que aún
no están en ninguna carpeta». Mover uno es cambiarle la carpeta, no copiarlo.

**Por qué no un archivador de verdad para él:** abre preguntas caras que nadie
quiere responder — si borra, ¿desaparece también para la agencia?, ¿hay
papelera?, ¿quién arregla el lío cuando mueva algo y no lo encuentre? Con la
regla de arriba no se dan: solo puede quitar lo que aún no ha colocado nadie.

**El acceso se concede, no se deriva del contenido.** Que Dani salga en una pieza
no le da derecho a nada: alguien de la agencia decide qué acaba en su carpeta.
Esto tumbó una vía anterior —conectar `designs.player` con una ficha de jugador
para que viera «sus» diseños— y de paso ahorra reconciliar los nombres escritos
a mano, que era lo más pesado del plan. Los diseños son de la agencia; el
jugador repostea lo que se publica.

**Todo el departamento creativo gestiona esas carpetas**, no un subconjunto.

### 6. Disposición elegida: portadas

De cuatro que se compararon (lista, portadas, dos columnas, y una sin pantalla
índice), gana **portadas**: cada carpeta enseña su última foto, y la zona de
subida **crece hasta el fondo** — el hueco que sobraba pasa a ser la diana donde
se sueltan los archivos. Dentro lleva una franja con «N enviados» para llegar a
lo que ya mandó, y así no hace falta una pantalla más.

Dentro de una carpeta, las entregas se separan por fecha («Jornada 12», «Sesión
de estudio»). Es un rótulo, **no una subcarpeta**: no hay un nivel más.

Hay una vista previa navegable en `preview`, sin funcionalidad y con datos
inventados: Ajustes → «Área personal del futbolista», visible solo para cuentas
de desarrollador.

### 7. Los archivos viven dentro de la app, no en Drive

**Esto rectifica una recomendación anterior** basada en estimaciones infladas.
Con los números reales —20 fotos al mes por chaval, de 2 a 8 MB— salen unos
100 MB por jugador y mes:

| | Gratis (el actual) | Pro (25 $/mes) |
|---|---|---|
| Almacenamiento | 1 GB | 100 GB, luego 0,021 $/GB |
| Descargas al mes | 5 GB | 250 GB |
| Base de datos | 500 MB | 8 GB |

**El plan gratuito no llega ni al piloto**: 1 GB son diez chavales durante un
mes. Con Pro sobra de largo — cien gigas son mil chavales-mes, y la cartera
completa de 150 tarda medio año en llenarlos; crecer a partir de ahí cuesta unos
4 $ más al mes por cada año que pasa.

**Para probar se sigue en el plan gratuito** (decidido el 2026-09-16). Un
gigabyte da para desarrollar y para ensayar con dos o tres chavales y pocas
fotos; entre un plan y otro no cambia nada del diseño, solo el techo. El salto a
Pro llega cuando entren jugadores de verdad. Lo que sigue sin haber mientras
tanto es entorno de pruebas para la base: las migraciones de esta fase van
directas a producción, como todas las anteriores.

### 8. La ficha del jugador y el alta por enlace

**La ficha es lo mínimo:** nombre, si está activo y un enlace opcional a su
cuenta. Un jugador existe en la app antes de tener cuenta —el fotógrafo le sube
fotos en octubre y él quizá entra en enero— y la mayoría de la cartera no la
tendrá al principio: entran menos de diez, los de primera división.

**El alta reutiliza las invitaciones que ya hay:** un enlace que caduca a las
24 horas y sirve una vez. No hace falta tener su correo; el enlace se le manda
por donde sea. Lo nuevo es que **el enlace nace desde la ficha**, en una sección
«Jugadores» del departamento creativo, y al aceptarlo la cuenta queda enganchada
a esa ficha sola. Nadie tiene que «asignarle el área» después.

**El formulario:** nombre, apellidos, correo, contraseña y confirmar contraseña.
Los apellidos van en **un solo campo**, `family_name`, que ya existe en
`profiles`; se barajó separar primer y segundo apellido y Mario lo descartó el
2026-09-16 («ya que el sistema los junta igualmente»). La cuenta nace marcada
como `JUGADOR` (§4) y sin roles.

**Quién invita:** `invitar_jugadores` lo tiene todo el departamento creativo;
`invitar_personal` sigue restringido a quien lo lleve en su rol.

Confirmado por Mario el 2026-09-16 como punto de partida para los primeros
chicos.

**Implementado el 2026-09-17** (§5, §6 y §8 a la vez; migración 046, aplicada
esa tarde; plan en
`docs/superpowers/plans/2026-09-17-jugadores-carpetas-y-almacen.md`; estado en
el §4 de septiembre de `docs/estado-y-traspaso.md`). Dos decisiones que el
texto de arriba dejaba implícitas: las carpetas no tienen tabla (son una
constante del código, como los tipos de diseño) y la entrega es un rótulo por
archivo, no una entidad.

### 9. El almacén: un cubo privado, una carpeta por jugador

Diseñado el 2026-09-17, en la misma tanda que lo implementó; cierra el punto
que el orden de trabajo dejaba abierto.

**Un solo cubo, `jugadores`, privado.** Nada se sirve por URL pública: ver o
descargar pasa siempre por una URL firmada de un minuto, que solo se puede
pedir si la regla del cubo deja leer ese objeto. Límite de 50 MB por archivo
(el techo del plan gratuito) e imágenes y vídeos solamente, HEIC incluido
porque es lo que hace el iPhone.

**La ruta dice de quién es.** Cada archivo vive en `{player_id}/{file_id}.{ext}`
y su miniatura en `{player_id}/{file_id}.thumb.jpg`. Las reglas de
`storage.objects` leen el jugador del primer tramo de la ruta: la agencia
(departamento creativo) puede todo en el cubo; el jugador lee y sube solo bajo
su propio tramo, y borra solo lo que subió él y siga sin colocar. Esa última
regla busca la fila de `player_files` **por la ruta misma** (jugador del
primer tramo, id del archivo del nombre), y la fila lleva la ruta atada por
restricción: una fila no puede apuntar a un objeto que no sea el suyo. Por
eso **se borra el objeto antes que la fila**, nunca al revés, y por eso la fila
se crea antes de subir nada.

**La fila es la verdad; el objeto, el contenido.** `player_files` guarda
carpeta, rótulo de entrega, nombre original, ruta, miniatura, tipo, tamaño y
quién lo subió. Mover un archivo cambia la carpeta en la fila; el objeto no se
toca. Borrar una ficha borra sus filas en cascada, pero el cubo no sabe de
cascadas: la app vacía la carpeta del jugador antes de borrar la ficha.

**Miniaturas en el navegador.** El plan gratuito no transforma imágenes en el
servidor, y una rejilla de veinte originales de 6 MB no cabe en un móvil. Al
subir una imagen se hace una miniatura JPEG de 480 px en el propio navegador y
se sube al lado; si el navegador no sabe decodificar el archivo, va sin
miniatura. Los vídeos van con icono.

**Cuánto ocupa:** lo del §7. Con Pro no cambia nada de esto, solo el techo.

---

## Lo que hay que arreglar antes de dar de alta al primer futbolista

> **Estado 2026-09-17:** las dos cosas de este apartado las resolvió la
> migración 045 (políticas por permiso y `handle_new_user` con el `search_path`
> bien escrito), aplicada ese día y comprobada con sesiones simuladas (§3 de
> septiembre de `docs/estado-y-traspaso.md`). Lo de abajo es la foto de antes.

**Cualquier usuario autenticado puede borrar cualquier diseño.** Comprobado
contra la base: la política de borrado de `designs` dice literalmente
`auth.uid() IS NOT NULL`. Lo mismo para crear y editar.

- **Entrada:** un futbolista con sesión llama a la API de Supabase con un DELETE
  sobre `designs`.
- **Esperado:** rechazado por no ser de la agencia.
- **Real:** borrado.

Hoy es inofensivo —sois ocho y os fiais— y por eso lleva ahí desde el principio.
Con gente de fuera dentro de la app deja de serlo. La app no le enseñaría el
botón, pero **esconder un menú no es proteger un dato**: es exactamente lo que
avisaba el pendiente §6 sobre no fiarse del cliente.

**Y hay una mina en el camino.** Comprobado: `is_admin` y `handle_new_user`
siguen con el `search_path` entrecomillado del pendiente §4 — el mismo defecto
que tumbó el alta por invitación durante meses. Son justo las dos funciones que
hay que tocar: una decide quién es admin, la otra crea el perfil al darse de
alta. No se pueden tocar sin arreglar eso a la vez, o se caen en silencio.

---

## Tamaño del cambio de permisos

Medido, no estimado:

- **9 políticas de seguridad** dependen del rol, en 6 tablas: `designs`,
  `profiles`, `invitations`, `invitation_uses`, `notifications`, `audit_log`.
- **25 archivos** del código leen el rol.
- **8 personas** que migrar: 4 admin y 4 diseñadores.
- Y sobre la base de **producción**, que es la única que hay.

---

## Orden de trabajo

1. **Permisos (RBAC del §4).** Es el tapón: un futbolista no cabe en
   `ADMIN`/`DESIGNER`. Incluye migrar a las ocho personas, cerrar las políticas
   de arriba y arreglar el `search_path`.
2. **La ficha del jugador y el alta (§8).** Dani tiene que existir en la base
   antes de tener cuenta. La invitación por enlace se reutiliza, atada a la
   ficha; la cuenta nace como `JUGADOR`.
3. **Carpetas, entregas y archivos (§5).** Dos piezas: `entregas` y `archivos`
   (la ficha `jugadores` viene del punto 2). Los envíos son archivos sin carpeta,
   no una tabla. Las carpetas probablemente no necesitan tabla: si son fijas e
   iguales para todos, una constante basta, como ya funcionan los tipos de
   diseño.
4. **El almacenamiento (§7).** Un cubo privado en Supabase Storage, con prefijo
   por jugador y reglas en `storage.objects` que solo dejen alcanzar lo propio;
   subida directa desde el móvil y descarga del original sin recomprimir. La
   estructura concreta del cubo está en el §9. Se prueba en el plan gratuito.

---

## Abierto

- **«Descargar las N» de una carpeta.** La maqueta lo tenía; la primera
  versión no: en iOS Safari varias descargas seguidas se bloquean, y un zip
  hecho en el navegador no cabía en la tanda. Hoy se descarga archivo a
  archivo desde su hoja. Si hace falta, la vía es una función en el servidor
  que empaquete y devuelva un solo enlace.
- **El salto a Pro.** Mario lo va a intentar cuanto antes, por espacio y por
  tener entorno de pruebas (ramas de base de datos). Hasta entonces, plan
  gratuito (§7). **Antes de estrenar las ramas hace falta una línea base de
  migraciones** (pendiente 9 de `docs/estado-y-traspaso.md`): las ramas se
  construyen reproduciendo la carpeta de migraciones, y tal como está fallaría.
- **Los departamentos de agentes y scouts**, aparcados a propósito.
- **Qué carpetas** tiene el área personal, aparte de Fotos y Matchdays.
- **Si el fotógrafo sube directo** a la carpeta del chaval o pasa por gestión.
- **Si se le avisa** cuando le entra algo nuevo.
- **Qué portada** enseña una carpeta que todavía está vacía.

## Más adelante, sin prisa

- **El agente responsable de cada jugador** (§4, al final). Una relación, no un
  permiso.
- **Dónde vive el campograma:** en este repositorio o aparte. No bloquea nada de
  esta fase, pero es decisión gorda y conviene tomarla antes de que haya tres
  repositorios.
