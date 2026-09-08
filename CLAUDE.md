# PHSPORT Dashboard — guía para Claude Code

Dashboard interno del equipo de diseño de PHSPORT: se reparten diseños entre
diseñadores, con fecha de entrega, y se marcan como entregados. Next.js (App
Router) + Supabase. En castellano de principio a fin: interfaz, comentarios de
código y mensajes de commit.

## Al empezar una sesión

1. **Sitúate.** En qué rama estás, si el árbol está limpio y si el remoto se ha
   movido desde la última vez:

   ```bash
   git branch --show-current && git status --short
   git fetch origin && git log --oneline HEAD..@{u}
   ```

2. **Lee `docs/estado-y-traspaso.md`.** Es la foto viva: en qué rama está cada
   cosa, qué decisiones se tomaron y por qué, y qué queda pendiente. Este archivo
   describe cómo se trabaja; aquel, dónde estamos. Mira su fecha: si han pasado
   semanas, trátalo como una pista y verifica contra el repo antes de darlo por
   bueno.

3. **No sincronices por tu cuenta.** Nada de `pull`, cambios de rama ni `stash`
   sin pedirlo: puede haber otra sesión trabajando en este mismo directorio.
   Si el remoto va por delante, dilo y espera.

## Ramas

**Se implementa en `preview`.** Ahí va todo lo nuevo: es la rama de trabajo y la
que despliega a staging. `main` es producción y **solo recibe lo que ya se ha
probado**. No se desarrolla sobre `main` ni se commitea ahí directamente.

El paso de una a otra **no es de trámite**: se decide qué sube y cuándo, y lo
decide Mario. `preview` puede acumular varias iniciativas a la vez, así que un
merge a ciegas subiría a producción cosas sin validar mezcladas con cosas
listas. Mira `docs/estado-y-traspaso.md` antes de proponerlo.

Las ramas de feature (`feat/…`) se integran en `preview`; una vez absorbidas no
tienen nada propio y no hace falta mantenerlas al día.

## Al cerrar una tanda

**Actualiza la documentación del área que tocaste**, en el mismo commit o en uno
seguido. La documentación es lo único que viaja entre equipos: lo que no quede
escrito, se pierde. Y un documento que miente es peor que no tenerlo, porque la
siguiente sesión arranca convencida.

| Si tocaste… | Actualiza |
|---|---|
| Cualquier cosa que cambie el estado: un merge, un pendiente resuelto, una decisión con la que habrá que convivir | `docs/estado-y-traspaso.md` |
| Convenciones, comandos, una trampa nueva que descubriste | `CLAUDE.md` |
| La matriz de navegadores o su cobertura | `docs/testing-navegadores.md` |
| Qué hace el producto, o cómo se pone en marcha | `README.md` |
| Un plan en curso (rediseño, refactor, móvil) | El plan correspondiente en `docs/` |
| Un consejo nuevo, o dónde aparece | `lib/help/tips.ts` es la fuente; no dupliques el texto en la pantalla |

`docs/estado-y-traspaso.md` se revisa **siempre**; los demás, solo si los tocaste.
Actualizar únicamente el de estado deja al específico mintiendo.

**No todos los documentos son vivos.** El inventario y las auditorías llevan
fecha en la cabecera y son fotos de un momento: envejecen a propósito y sirven
para comparar contra el presente. No los reescribas; si su contenido ya no se
sostiene, dilo en el documento vivo que corresponda.

Anota también los rodeos, no solo los aciertos: por qué se descartó una vía o qué
diagnóstico resultó falso. Eso es justo lo que evita repetir el camino largo.

## Arrancar en un equipo nuevo

```bash
nvm use                       # Node 22.18, fijado en .nvmrc
npm install
npx playwright install        # los motores no viajan con el repo
npm run dev
```

Hace falta un `.env.local` que **no está versionado** (lo bloquea `.gitignore`).
Son cuatro variables y la plantilla comentada está en `.env.example`; de dónde
sale cada valor, en `docs/operaciones-y-entorno.md`. Sin él la app no arranca:
pídeselas a Mario en vez de inventarlas.

**Node 22.18** (`.nvmrc`), npm 10. Si algún documento dice «Node 24», está
caducado: el proyecto nunca se ha construido sobre esa versión en local. En
Vercel manda lo que tenga configurado el proyecto, que no tiene por qué
coincidir — mirar el panel antes de culpar a la versión.

**Al mudarse de equipo hay un guion paso a paso** en
`docs/operaciones-y-entorno.md`, apartado «Mudarse a otro equipo».

## Comandos

| Qué | Comando |
|---|---|
| Desarrollo | `npm run dev` |
| Tests unitarios | `npm test` (vitest) |
| Tests de navegador | `npm run e2e` — ver `docs/testing-navegadores.md` |
| Tipos | `npx tsc --noEmit` |
| Lint | `npm run lint` |

**El rendimiento y el pintado se miden sobre `npm run build && npm start`, nunca
sobre `npm run dev`**: en desarrollo el CSS y el JS van sin optimizar y lo que se
ve no es lo real.

## Cómo está montado

```
app/(dashboard)/     inicio · mi-semana · disenos · equipo · ajustes · ayuda
app/api/designs/     rutas de servidor, con validación zod en lib/api/schemas.ts
components/ui/       sistema de diseño propio (Surface, Row, PulseDot…) + shadcn
components/layout/   shell: header, sidebar, tab bar móvil
lib/hooks/           datos vía SWR
lib/help/            catálogo de consejos + su lógica pura
lib/utils/           lógica pura — aquí es donde viven los tests
supabase/migrations/ SQL numerado
e2e/                 Playwright
```

**La lógica que merece test vive en `lib/utils/`, en funciones puras**, y el hook
solo hace el fetch. Ese es el patrón del proyecto: si algo necesita pruebas,
sácalo ahí en vez de testear el componente.

**Los consejos de la app se escriben en un solo sitio: `lib/help/tips.ts`.** De
ahí salen las tres caras —el aviso en contexto (`<Tip>`), el «?» (`<HelpHint>`) y
la página `/ayuda`—, así que añadir uno es añadir una entrada y nada más. Dos
cosas que no se ven en el archivo:

- **Los `id` son anclas públicas** (`/ayuda#<id>`) y a la vez la clave con la que
  se recuerda un descarte. Renombrar uno rompe enlaces guardados y hace
  reaparecer un aviso que alguien ya había ocultado.
- **`<HelpHint>` no sustituye a `<Hint>`.** `Hint` es un tooltip de una línea que
  nombra un control y necesita puntero; `HelpHint` es un popover con explicación
  que funciona al tacto. Antes de añadir uno, mira cuál de los dos toca.

Criterio para admitir un consejo, que es lo que evita que esto se llene: entra si
explica algo que la pantalla no puede decir sola y que, sin saberlo, lleva a una
conclusión equivocada. «Pulsa el botón para abrir el diálogo» no entra.

## Cómo se trabaja aquí

**Despacito y con buena letra.** Los cambios grandes van por fases pequeñas con
validación entre pasos, nunca de golpe. No es manía: este proyecto arrastra deuda
de una etapa de aprendizaje, y los intentos de cambiar mucho a la vez acabaron
rompiendo cosas que no se estaban tocando. Ir deprisa aquí sale caro.

En la práctica:

- Antes de un refactor de varios pasos, explicar el orden y el porqué de ese
  orden, y esperar confirmación.
- Después de cada fase, pasar tipos, lint y build, y contarlo antes de seguir.
- Las abstracciones se sacan del uso real, no se inventan «por si acaso».
- Cuando una decisión afecte al alcance o a la prioridad, preguntar con opciones
  concretas, no en abierto.
- **Exhaustividad antes que velocidad.** Si aparece un problema estructural en
  una zona, dar por hecho que el patrón se repite en otras: auditar antes de
  seguir maquillando.
- **Varios intentos estéticos fallidos sobre el mismo elemento significan que el
  problema es estructural**, no de criterio. Parar y diagnosticar el componente
  en vez de seguir moviendo colores y espaciados.

## Convenciones

- **Castellano en todo**, incluidos los comentarios. Los identificadores de
  código, en inglés.
- Los comentarios explican **por qué**, no qué. Si algo parece un error y no lo
  es —un `bg-background/[0.99]`, por ejemplo—, di por qué o alguien lo
  «arreglará».
- Mensajes de commit en imperativo y en prosa: `fix(movil): la pastilla del menú
  deja de caer en diagonal`. Describen el efecto observable, no el diff.
- No se hace commit ni push salvo que Mario lo pida.

## Trampas conocidas

**Sesiones en paralelo sobre el mismo árbol.** A veces hay otra sesión de Claude
Code trabajando en el mismo directorio y cambiando de rama. Comprueba
`git branch --show-current` antes de commitear, y añade rutas explícitas — nunca
`git add -A`.

**El historial de migraciones diverge de los archivos locales.** Hay números
duplicados y migraciones aplicadas a mano que no constan en el registro de
Supabase. Antes de escribir DDL: mira el número real con un `ls` de la carpeta e
**inspecciona el estado vivo de la base** (`pg_policies`, `pg_trigger`,
`pg_get_functiondef`) en vez de fiarte de los archivos.

**La base de datos de desarrollo es la de producción.** No hay entorno de
staging: `.env.local` apunta al proyecto real. Todo lo que se escriba lo ven los
diseñadores. Lee cuanto quieras; para escribir, pregunta.

**Ante un fallo visual, mira la pantalla antes de teorizar.** Hay matriz de
Playwright: se puede cargar una página, medir cajas, leer estilos calculados y
capturar, en cuatro motores. Un fallo de maquetación se diagnosticó en minutos
así, después de cuatro intentos fallidos razonando sobre el motor sin verlo.

**Las capturas de referencia se hicieron en Windows.** Las dos que hay en
`e2e/__capturas__/` se generaron en la máquina de Windows de Mario. macOS y Linux
dibujan las tipografías de otra forma, así que **en otro sistema esos dos tests
fallan sin que haya ningún fallo real**. No es una regresión: es la línea base,
que es específica del sistema. Si se trabaja desde otro equipo, comparar el
diff visual a ojo y, si solo cambia el grosor del texto, regenerarlas ahí con
`npm run e2e:capturas` — asumiendo que a partir de entonces fallarán en Windows.

**Un componente de shadcn no admite media controla.** Si expone
`defaultOpen` + `open` + `onOpenChange` y solo le pasas `onOpenChange`, avisa al
padre de cada cambio pero su estado interno nunca se mueve: se queda tieso hasta
que recargas. O usas solo `defaultOpen` (y dejas que él persista, que casi
siempre ya lo hace por cookie), o pasas `open` **y** `onOpenChange` y llevas tú
el estado. Mezclar rompe el contrato. Pasó de verdad con la sidebar, que exigía
recargar para verse el despliegue.
