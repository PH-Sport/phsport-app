# Operaciones y entorno

> **Actualizado:** 2026-09-07, al preparar el salto de la máquina de Windows a un
> Mac.
> **Para qué sirve:** lo que hace falta para operar el proyecto y **no se puede
> deducir leyendo el código**: qué servicios hay detrás, qué clave vive en qué
> panel, cómo está montado el correo y qué trampas ya se pisaron. Hasta hoy esto
> vivía en la memoria local de una sola máquina; si esa máquina desaparece, se
> pierde. Por eso está aquí.
>
> Es un **documento vivo**: cuando algo cambie, se corrige. Lo que sí lleva fecha
> a propósito son las comprobaciones concretas, para saber cuándo dejaron de ser
> fiables.

---

## El mapa de servicios

Seis piezas, y ninguna se deduce del repositorio:

| Servicio | Qué hace aquí | Dónde se administra |
|---|---|---|
| **GitHub** | El repositorio | `PH-Sport/phsport-app` |
| **Vercel** | Construye y despliega la app | Panel de Vercel (ojo con el scope, abajo) |
| **Supabase** | Base de datos, auth, realtime, storage y edge functions | Proyecto «Dashboard - PHSPORT» |
| **Cloudflare** | DNS de `phsport.app` (SPF, DKIM, DMARC) | Panel de Cloudflare |
| **Resend** | Envío de correo, para los dos emisores | Panel de Resend |
| **Anthropic** | El agente que interpreta el encargo al crear diseños | Consola de Anthropic |

### GitHub: el repositorio se movió, y luego se renombró

Vive en **`PH-Sport/phsport-app`**, dentro de la organización. Arrastra nombres
viejos que siguen redirigiendo: `RodzCantCode/ph-sport-dev`, de cuando estaba en
la cuenta personal, y `PH-Sport/ph-sport-dashboard`, hasta el 2026-09-07.

Dos motivos para el nombre nuevo. El proyecto dejó de ser solo el dashboard de
diseño —la idea es que acabe siendo la app general de la casa—, y la marca pasó
de «PH Sport» a **PHSPORT**, sin espacio ni guion. De ahí `phsport-app`, a juego
con el proyecto de Vercel. **La organización de GitHub sigue llamándose
`PH-Sport` y se queda así a propósito:** renombrarla movería la URL de los cuatro
repositorios a la vez.

**Las redirecciones de GitHub son cómodas y traicioneras.** Un clon viejo sigue
funcionando, así que nada se rompe y nadie se entera de que apunta al nombre
antiguo — que es exactamente cómo un proyecto de Vercel se quedó enganchado al
repositorio de la cuenta personal. En un equipo nuevo, clonar de la dirección
buena y no de un enlace guardado; en un clon existente, `git remote set-url`.

### Vercel: el proyecto que se ve desde las herramientas no es el bueno

Comprobado el 2026-08-10 y sigue siendo así. Desde la sesión de Claude Code, el
conector de Vercel está autenticado en el equipo personal **«Rodz»**, y desde ahí
solo se ven dos proyectos, **ninguno de los cuales sirve**:

- **`ph-sport-dev`** — es el dashboard y tiene los dominios buenos, pero está
  conectado al **repositorio antiguo**. Su último despliegue es de **enero de
  2026**, aunque desde entonces ha habido decenas de pushes.
- **`ph-sport-web`** — es la web pública de `phsport.es`, en Astro. Otro proyecto.

El despliegue de verdad cuelga de la organización de GitHub, así que su proyecto
de Vercel vive en **otro scope que esas herramientas no ven**.

**Consecuencia práctica, y es importante:** nunca deduzcas de ahí una URL de
preview, y **nunca concluyas que «un push no ha desplegado» porque la herramienta
no lo muestre** — está mirando otro proyecto parado hace meses. Para saber si algo
desplegó: el panel de Vercel de la organización, o el check de GitHub en el
commit.

### Supabase: no hay CI, las migraciones se aplican a mano

Proyecto **«Dashboard - PHSPORT»**, referencia `zhuluiqpakuwehibjyva`. Es la
única organización y el único proyecto. **No hay `supabase/config.toml` ni
ninguna automatización**: cada migración se aplica a mano, por el editor SQL o
por la herramienta.

Eso explica la trampa que ya está avisada en `CLAUDE.md` y conviene entender, no
solo obedecer:

- El historial que Supabase registra usa **marcas de tiempo**, y **no coincide
  uno a uno con los archivos numerados del repo**. Al revisarlo en junio de 2026,
  el historial saltaba de la 022 a la 035: **las migraciones 023 a 034 no constan
  registradas**, aunque sus efectos sí están en la base.
- La **numeración local está duplicada**: hay dos archivos `036` y dos `037`,
  porque se crearon en ramas distintas a la vez. Producción no se rompió —allí se
  ordena por marca de tiempo, no por nombre de archivo— pero el orden del
  directorio es ambiguo.
- Y las migraciones **041, 042 y 043 se aplicaron directamente sobre producción**
  antes de que su código estuviera desplegado. Los archivos del repo son la copia
  para el control de versiones; **volver a lanzarlas no haría falta**.

**Antes de escribir cualquier DDL:** mira el número más alto real con un listado
del directorio, y **consulta el estado vivo de la base** (políticas, triggers,
definiciones de funciones) en vez de fiarte de los archivos. Los archivos
describen la intención; la base describe la realidad, y aquí divergen.

---

## Qué clave vive dónde

Cuatro sitios distintos, y confundirlos es la forma habitual de perder una tarde:

| Clave | Dónde vive | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` y Vercel | Pública; la protección real es RLS |
| `NEXT_PUBLIC_VAPID_KEY` | `.env.local` y Vercel | Solo la **pública** del par VAPID |
| `ANTHROPIC_API_KEY` | `.env.local` y Vercel | **Secreta.** Sin ella el agente no responde |
| `RESEND_API_KEY` | Supabase → Edge Functions → Secrets | **Secreta**, y hay una por consumidor |
| `RESEND_FROM_EMAIL` | Supabase → Edge Functions → Secrets | |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Supabase → Edge Functions → Secrets | La privada, **secreta** |
| Credenciales SMTP de Auth | Supabase → Authentication → Emails | Ver abajo |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **los inyecta Supabase solo** en las
edge functions: no hay que configurarlos.

**La clave de Anthropic degrada en silencio.** Si falta, la ruta del chat
responde `200` con un aviso de reserva y el taller de creación sigue funcionando
a mano. Eso permitió publicar sin confirmarla, pero significa que **puede estar
apagada en producción sin que salte ninguna alarma**. Está anotado como pendiente
en `docs/estado-y-traspaso.md`.

### El `.env.local` de la máquina de Windows está incompleto

Comprobado el 2026-09-07, y conviene saberlo **antes** de copiarlo a otro equipo,
porque copiarlo tal cual arrastra el agujero:

- Tiene **tres** variables: las dos de Supabase y `NEXT_PUBLIC_APP_URL`.
- **`NEXT_PUBLIC_APP_URL` no la lee nadie.** Está ahí de una etapa anterior, y de
  ahí venía la confusión: la documentación la declaraba obligatoria porque
  aparecía en el fichero real, no porque el código la usara. Se puede borrar.
- **Faltan `ANTHROPIC_API_KEY` y `NEXT_PUBLIC_VAPID_KEY`.** Las dos degradan en
  silencio, así que la app arranca igual y nadie se entera: en local **el agente
  de creación de diseños no responde** y **las notificaciones push no se pueden
  probar**. No es un fallo del código; es una configuración a medias.

Al montar el equipo nuevo, la ocasión es buena para dejarlo completo: la de
Anthropic se saca de la consola de Anthropic (o se copia de Vercel, si ya está
puesta allí), y la pública de VAPID tiene que ser **la misma** que la del par
guardado en los secretos de Supabase — si se genera un par nuevo, las
suscripciones push existentes dejan de valer.

---

## El correo: hay dos emisores, y no son el mismo

Esta es la parte que más tiempo ha costado, y la que peor se deduce del código.

**Emisor 1 — Supabase Auth, por SMTP.** Manda la recuperación de contraseña y la
confirmación de cuenta. Va por `smtp.resend.com:465`, usuario `resend`, remitente
`noreply@phsport.app`. **El nombre visible del remitente vive en el panel**
(Authentication → Emails → SMTP Settings, campo `Sender name`), **no en el
código**: buscarlo en el repositorio es perder el rato.

**Emisor 2 — la edge function `send-notification-email`.** Manda los avisos de
diseños llamando a la API de Resend. Aquí el nombre del remitente **sí está en el
código**, así que cambiarlo obliga a **volver a desplegar la función**.

Que los dos digan lo mismo importa más de lo que parece: **el avatar de colores
que pinta Gmail se genera a partir del nombre del remitente**, así que mientras
no coincidieran, los correos se veían como si vinieran de dos sitios distintos.
Un logo de verdad exigiría BIMI (DMARC en cuarentena o rechazo, más un
certificado de pago): **descartado**.

**Una clave de Resend por consumidor** (decisión de agosto de 2026): una para el
SMTP de Auth y otra para las notificaciones. Así, rotar una no tumba la otra.

### El DNS y por qué faltaba el enlace

El DNS de `phsport.app` está en **Cloudflare**. SPF y DKIM estaban verificados
desde el principio, pero **no existía registro DMARC**, y esa ausencia era
exactamente lo que hacía que **Gmail borrase el enlace del correo de
recuperación**. Se publicó el 4 de agosto de 2026 como TXT en `_dmarc`, en
política de observación (`p=none`) con informes al correo de Mario. Si algún día
molestan los informes, se pueden quitar, **pero el registro tiene que seguir
existiendo**.

### Las plantillas y la trampa que tumbó producción

Las plantillas de los correos de Auth **solo viven en el panel de Supabase**, así
que hay una copia versionada en `supabase/templates/` (`recovery.html` y
`confirmation.html`): se edita ahí y se pega en el panel.

Tres cosas comprobadas a base de romper cosas:

- **El enlace no puede empezar por `{{ .SiteURL }}`, ni llevar condicionales.** El
  motor de plantillas deja el token en un contexto ambiguo y **revienta el envío
  entero con un error 500**, sin llegar siquiera a intentar el SMTP. Dominio
  literal siempre.
- **Cuando un envío falle, ir directo a Logs → Auth**, que da el error exacto de
  renderizado. Teorizar sin ese registro costó dos hipótesis equivocadas
  seguidas.
- **Gmail no renderiza SVG en los correos.** El logo del aviso de notificaciones
  es SVG, así que probablemente no se ve. Las plantillas de Auth usan PNG.

**Para probar sin tocar la interfaz:** una petición `POST` a `/auth/v1/recover`
con la clave anónima dispara el correo real, y el panel de Resend deja leer el
HTML exacto que se envió, con un análisis de los factores de spam.

**Pendiente menor, de agosto de 2026:** las dos plantillas del panel siguen
sirviendo el icono grande de iOS en vez del logo de correo de 192 px. El repo ya
está bien; basta con pegar las versiones de `supabase/templates/`. Es solo peso
—28 KB frente a 2,8—, no un fallo visible.

---

## Tests de navegador y la cuenta de pruebas

Los tests que necesitan sesión **se saltan solos si no hay credenciales** en el
entorno, y el resto sigue corriendo. Para ejecutarlos con sesión:

```bash
PLAYWRIGHT_USER=… PLAYWRIGHT_PASS=… npm run e2e
```

Hasta hoy se han ejecutado con **la cuenta real de Mario**, que es de mánager,
tiene el indicador de desarrollador y **apunta a producción**. Los tests
actuales solo leen, así que es aceptable; **en cuanto haya uno que cree o borre
diseños, hace falta una cuenta aparte**.

Las capturas de referencia son **específicas del sistema operativo**: ver la
trampa correspondiente en `CLAUDE.md`.

---

## Mudarse a otro equipo

En orden, porque el orden importa:

1. **Clonar de la dirección buena:** `PH-Sport/phsport-app`. Si reutilizas
   un clon antiguo, comprueba a dónde apunta el remoto.
2. **Node 22.18** — `nvm use` lo coge de `.nvmrc`. No instales Node 24 aunque lo
   diga algún documento viejo.
3. **`npm install`.** No copies `node_modules` de la otra máquina: hay
   dependencias con binarios compilados que son distintos por sistema y
   arquitectura.
4. **Llevarte `.env.local` a mano.** No está en git y no se puede reconstruir
   desde el repositorio. **No lo copies tal cual**: el de la máquina de Windows
   tiene tres variables, una de ellas inútil y dos que faltan (ver arriba). Lo
   correcto son cuatro: las dos de Supabase, la de Anthropic y la pública de
   VAPID. La de Anthropic es secreta — cópiala por un canal decente, no por chat.
5. **`npx playwright install`**, si vas a ejecutar tests de navegador: los motores
   no viajan con el repositorio.
6. **`npm run dev`** y comprobar que entras. Si la app arranca pero no hay datos,
   es `.env.local`.
7. **Contar con que los dos tests de captura fallarán** en un sistema que no sea
   Windows. No es una regresión.
8. **La configuración de Claude Code no viaja**: `.claude/` está excluido a
   propósito. En el equipo nuevo hay que volver a instalar plugins y dar
   permisos.

**Lo que no hace falta llevarse:** nada de la base de datos ni de los paneles.
Todo apunta al mismo Supabase de producción desde cualquier máquina — que es
cómodo y peligroso a partes iguales. Ver el aviso de `CLAUDE.md`: **leer cuanto
quieras; para escribir, preguntar.**

---

## Herramientas: el fallo de autenticación que se repite

El conector de Supabase falla de vez en cuando con **«Unrecognized client_id»**, y
**la culpa no es del plugin**. Cada inicio de sesión pide unas credenciales
nuevas y las guarda; Supabase las caduca pasado un tiempo, pero el cliente sigue
reutilizando las guardadas. Reinstalar el plugin no arregla nada, porque las
credenciales viven fuera de él y sobreviven a la reinstalación.

**El arreglo** es borrar solo las entradas de Supabase del archivo de credenciales
de Claude Code y el caché de autenticación pendiente, y volver a autenticar. La
señal de que ha funcionado es que **sale un identificador distinto al anterior**,
antes incluso de abrir el navegador. Copia de seguridad primero, y **borrar solo
las claves de Supabase**: en ese archivo también están la sesión de Claude Code y
las de GitHub y Vercel.

Hay un guion de limpieza para Windows en la máquina de Mario; **en el Mac habrá
que rehacerlo**, pero el diagnóstico y el orden de los pasos son los mismos.
