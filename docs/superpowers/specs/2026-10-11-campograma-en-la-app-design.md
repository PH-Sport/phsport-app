# El campograma entra en la app: departamento de Agentes y cartera editable

**Fecha:** 2026-10-11, decisiones tomadas con Mario el 2026-10-10 y el 2026-10-11
**Estado:** diseño cerrado. Fases 1 (Agentes) y 2 (la cartera en la base)
hechas el 2026-10-11 y el 2026-10-12; ver §1 y §2 de octubre en
`docs/estado-y-traspaso.md`. Siguiente: fase 3.
**Alcance:** el departamento de Agentes, la cartera de jugadores con su campograma
y su edición, y el autocompletado de nombres al crear diseños.

---

## Por qué existe este documento

El campograma vive hoy en otro repositorio (`campograma-ph`). Es una página
estática que lee un JSON. Cada alta, cada cambio de club y cada baja pasa por
Mario, que edita el archivo a mano y lo despliega. Los agentes, que son los que
llevan a los chicos, no pueden tocar nada.

Lo que se quiere: **que los agentes den de alta, cambien y den de baja a los
jugadores ellos mismos, desde el móvil o el ordenador.** Para eso hacen falta
cuentas y una base de datos, y la app ya tiene las dos cosas. El spec de
septiembre (`2026-09-14-roles-departamentos-y-jugadores-design.md`) ya reservaba
un departamento de «Agentes y scouts» cuya sección era el campograma. Este
documento lo concreta.

De paso se resuelven tres pendientes del campograma: la URL pública con los
datos de la cartera (incluidos menores), la baja que borraba sin dejar rastro y
el campo `division` que faltaba.

---

## Lo decidido

### 1. Cartera propia, separada de las fichas de creativo

Lo ideal a largo plazo es una sola ficha por chaval, pero Mario lo descarta por
ahora: las carpetas de archivos de creativo (`players`) siguen en el aire y no
serán para todos. **La cartera es su propia tabla.** Cada jugador de la cartera
lleva un enlace opcional a su ficha de creativo, vacío de momento, para que
juntarlas algún día sea rellenar ese hueco y no una migración de datos.

**No se deduplica por nombre.** Hay apellidos repetidos que son personas
distintas (Tomás Mendes y Tomás Méndez, los hermanos Buyla, los Stassin).

### 2. Departamento de Agentes, con dos roles

| Rol | Quién | Puede |
|---|---|---|
| **Director** | Ángel y Julio | Todo lo de Agente, más invitar agentes, dar el rol de Agente o Director, dar de baja y recuperar jugadores |
| **Agente** | El resto | Ver toda la cartera, dar de alta y editar jugadores |

Mario también invita agentes. Mario podrá tener roles de los dos departamentos
a la vez, como ya preveía el spec de septiembre.

«Otras opciones» para los directores quedan por concretar: se añadirán como
permisos cuando Mario las diga.

### 3. Qué ve cada uno

- **Agentes:** la entrada «Campograma» y lo común a cualquier cuenta (perfil,
  ajustes, ayuda). Entran directos al campograma. No ven Inicio, Semana,
  Diseños, Equipo ni Jugadores, que son de creativo.
- **Creativo:** no ve la cartera ni el campograma. Recibe solo **nombre y equipo
  actual** de cada jugador activo, para autocompletar al crear diseños (§7). El
  equipo actual es el club de la cesión si está cedido, y si no, el club
  propietario: es la camiseta que sale en el diseño. La base no le da nada más,
  aunque lo pida directamente.
- **Quien tenga roles en los dos departamentos** ve las dos cosas.

### 4. El campograma: lo mismo que hoy, con el aspecto de la app

Selector de categoría, vista Campo con los once puestos y su contador, vista
Lista ordenable, panel de cada puesto con la ficha del jugador, contadores de
cedidos / pendientes / sin club, y los entrenadores al final.

La **colocación del campo y su comportamiento se conservan** (de pie y atacando
hacia arriba en estrecho, tumbado y atacando a la derecha en ancho, LI arriba y
LD abajo al girar). El aspecto pasa a ser el de la app: sus tokens, su letra,
sus hojas.

**La búsqueda abarca toda la cartera**, no solo la categoría elegida. Cada
categoría dice cuántas coincidencias tiene y, si la activa no tiene ninguna, se
ofrece saltar a la que sí. Sin acentos: «munoz» encuentra a Muñoz.

Las trampas de geometría y de datos del campograma están en su
`docs/work/active/handoff-2026-09-03.md` (apartado «Trampas») y se leen antes de
portar el campo.

### 5. Editar

- **Alta.** Botón «Nuevo jugador». Obligatorios: nombre, demarcación y
  categoría. Opcionales: año y club; en blanco se muestran «sin confirmar».
  Situación: ninguna, cedido (pide destino) o movimiento pendiente.
- **Mismo nombre y año que alguien que ya existe:** aviso y pregunta «¿es otra
  persona?». No bloquea ni junta.
- **Cambiar datos.** «Editar» en la ficha abre el mismo formulario relleno.
  Cualquier campo, nombre incluido.
- **Baja.** «Dar de baja» en la ficha pide motivo y confirmación. **Solo
  directores** (y Mario). No borra: guarda fecha, motivo y quién, y el jugador
  sale del campo y de la lista. Los de baja tienen su lista aparte, desde donde
  los directores los recuperan.
- **Historial.** En la ficha, los últimos cambios: qué, quién y cuándo, con el
  valor anterior y el nuevo.
- **Dos personas a la vez sobre el mismo jugador:** se queda el último que
  guarda, y el historial enseña los dos. No se montan bloqueos.
- **Móvil:** ficha y formulario en hoja inferior, la misma pieza de
  Notificaciones y del perfil. Escritorio: panel lateral.

### 6. Los datos de cada jugador

Lo que tiene hoy el campograma, más tres cosas:

| Dato | Notas |
|---|---|
| Nombre | Tal como lo escribe PH |
| Año de nacimiento | Cuatro dígitos; vacío = sin confirmar |
| Club propietario | Vacío = sin confirmar |
| Situación | Ninguna, cedido o movimiento pendiente |
| Cedido a | Solo con situación «cedido» |
| Demarcación | Las once del campograma, fijas en código |
| Categoría | De la lista de categorías |
| Foto | URL o nada |
| **División** | Nueva, vacía. No está en el origen y no se inventa |
| **Activo / de baja** | Con fecha, motivo y quién dio la baja |
| **Ficha de creativo** | Enlace opcional a `players`, vacío por ahora |

**Categorías:** 1ª / 2ªA / Internacional, RFEF, Cantera y Sin confirmar, cada una
con su entrenador si lo tiene. **RFEF se llama «RFEF» a secas**, sin desglosar 1ª,
2ª y 3ª. La lista se cambia por migración, como los roles; sin pantalla.

### 7. Autocompletado al crear diseños

Jota se queja de que crear diseños es demasiado manual. En el campo «jugador» de
cada **tarjeta** del chat de creación, al escribir «Ju» salen «Juan Cruz»,
«Juanjo Sánchez»…, con el equipo actual al lado para distinguirlos.

Solo en la tarjeta: el chat no consulta la cartera. **El diseño sigue guardando
el nombre como texto.** No se enlaza con la cartera: en septiembre se descartó
enlazar diseños con fichas para decidir quién ve qué, y esto no lo reabre. Solo
ayuda a escribir.

### 8. Retirada del campograma suelto

Conviven hasta que todos los que hoy lo usan pasen a la app; Mario calcula que
no más de una semana. Sin aviso en la página vieja: hay pocas actualizaciones y
el cambio será rápido. Después, se apaga la web pública y el repositorio pasa a
privado y archivado. Las dos cosas las hace o las autoriza Mario en el momento.

---

## Lo que hay que cambiar en la app para que esto funcione

Comprobado en el código y en las migraciones el 2026-10-11. Son los puntos donde
la app da por hecho que toda cuenta de la agencia es de creativo.

1. **La cara de la app.** `viewModeFor()` devuelve `designer` si la cuenta tiene
   `recibir_asignaciones` y `manager` en cualquier otro caso. Un agente caería
   en `manager`: entraría en `/inicio` y vería toda la navegación de creativo.
   Hace falta que la navegación y la página de entrada dependan del
   departamento, no solo de ese permiso.
2. **La navegación no filtra por departamento.** `buildNavItems()` da Inicio,
   Semana, Diseños y Jugadores a toda cuenta de la agencia. Cada entrada tiene
   que declarar de qué departamento es.
3. **`gestionar_roles` es global.** Quien lo tiene asigna cualquier rol de
   cualquier departamento. Un director no debe poder hacer a nadie Gestor
   creativo: hace falta un permiso propio para dar roles de Agentes, y que
   Ajustes → Miembros solo le ofrezca esos.
4. **Invitar.** Lo mismo con `invitar_personal`: el director invita solo a roles
   de Agentes.
5. **El registro de cambios existente no sirve para la cartera.** `audit_log`
   es de diseños y solo lo leen quienes tienen `gestionar_roles`. La cartera
   lleva su propio historial, legible por todo el departamento de Agentes.
6. **El alta por invitación marca a toda cuenta nueva como `DESIGNER`** en la
   casilla antigua `profiles.role`, y `main` (producción) toma por diseñador a
   todo `DESIGNER`: lo lista y le reparte diseños. Un agente tiene que nacer con
   otro valor en esa casilla hasta que la 049 la borre, igual que se hizo con
   `JUGADOR` en la 046.
7. **Lo que ya está bien:** diseños y fichas de creativo exigen
   `in_department(…, 'creativo')`, así que un agente no los ve aunque llegue a
   la ruta. `profiles` es legible por todo el personal (`is_staff`), así que un
   agente verá nombres y avatares del equipo, lo que hace falta para el
   historial.

---

## Orden de trabajo

Por fases pequeñas, con tipos, lint, tests y build entre una y otra, como pide
`CLAUDE.md`. Cada migración **solo añade** (la base es la de producción) y se
aplica con permiso expreso de Mario.

1. **Agentes: departamento, roles y permisos.** Migración con los dos roles y los
   permisos nuevos; la cara y la navegación por departamento; Miembros e
   invitaciones acotados para directores. Mario asigna los roles.
2. **La cartera en la base.** Tablas de jugadores, categorías e historial, con
   sus políticas, más la consulta de nombres y equipo para creativo. Carga
   inicial de los jugadores del campograma.
3. **El campograma, solo consulta.** Campo, lista, panel, ficha, búsqueda,
   contadores y entrenadores.
4. **Editar.** Alta, edición, baja y recuperación, aviso de duplicado e historial.
5. **Autocompletado** en la tarjeta del chat de creación.
6. **Retirada** de `campograma-ph`, con un ADR allí que sustituya al 0001
   (proyecto separado) y cierre el 0003 (producción pública).

---

## Riesgos y cosas a tener presentes

- **Llegar a los agentes depende del merge de `preview` a `main`.** Los agentes
  usan producción, y `preview` va por delante con la tanda de roles y jugadores
  sin validar del todo (pendientes 11 y 12 de `estado-y-traspaso.md`). Mario
  quiere que ese merge espere. El campograma no estará en manos de los agentes
  hasta que se haga, o hasta que se decida otra vía.
- **La carga inicial sale del JSON de `campograma-ph`.** A 2026-10-11 ese
  archivo tiene cambios sin commitear (tres altas que pasan a RFEF). Hay que
  commitearlos antes de cargar. Los huecos («sin confirmar», las dudas para Eva)
  viajan tal cual: nada se rellena por el camino. (Hecho: se cargó el
  2026-10-12 desde el commit `5ac5f57`, del 2026-10-10, sin datos en este repo.)
- **Menores.** La cartera tiene decenas de menores con club y operaciones. Al
  entrar en la app quedan detrás de cuenta y de políticas de base; el historial
  público de `campograma-ph` en GitHub no se arregla con esto, sino con la
  retirada (fase 6).
- **La cartera de la web pública (`ph-sport-web`) sigue siendo otra.** Esto no la
  toca. Que la web lea algún día de esta cartera es una decisión aparte.

## Fuera de alcance

- Unir la cartera con las fichas de creativo (§1).
- El agente responsable de cada jugador: todos los agentes ven y editan todo.
- Pantalla para crear categorías o roles.
- Que el chat de creación conozca la cartera (§7).
- Rellenar división, clubes o categorías sin confirmar.
