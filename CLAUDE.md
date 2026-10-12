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
| Convenciones, comandos, una trampa nueva que vale para todo el repo | `CLAUDE.md` |
| Una trampa nueva que solo importa al tocar una zona | Su regla en `.claude/rules/` (ver «Reglas por zona») |
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

Node 22.18 (`nvm use` lo coge de `.nvmrc`), `npm install`, `npx playwright
install` y `npm run dev`. Hace falta un `.env.local` que **no está versionado**:
son cuatro variables y la plantilla comentada está en `.env.example`. Sin él la
app no arranca: pídeselas a Mario en vez de inventarlas. El guion paso a paso
para mudarse de equipo, la versión de Node y de dónde sale cada valor están en
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
app/(dashboard)/     inicio · mi-semana · disenos · equipo · jugadores · campograma · ajustes · ayuda
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

## Reglas por zona

Lo que solo hace falta saber al tocar una carpeta concreta no está aquí: está en
`.claude/rules/`, un archivo por zona. Cada uno lleva en cabecera las rutas a las
que aplica y Claude Code lo carga solo al trabajar con ellas. Si vas a razonar
sobre una de estas zonas sin abrir sus archivos, léela antes.

| Zona | Regla | De qué avisa |
|---|---|---|
| `components/layout/`, `app/layout.tsx`, `app/globals.css`, `app/manifest.ts` | `cabecera-y-pwa.md` | Safari 26, iOS 26, el fundido de la tab bar, `sticky` y no `fixed` |
| `supabase/` | `migraciones.md` | El historial diverge, la base viva manda, «añadir» y «quitar», políticas del cubo |
| `lib/utils/access.ts`, `lib/auth/`, `app/api/`, `supabase/migrations/` | `permisos.md` | Un solo sitio para los permisos; nunca comparar nombres de rol; Agentes va aparte |
| `lib/help/`, `<Tip>`, `<HelpHint>`, `/ayuda` | `consejos.md` | Los ids son públicos, qué consejo entra, tooltip frente a popover |
| `components/` | `componentes-ui.md` | El componente de shadcn a medio controlar |
| `e2e/`, `playwright.config.ts` | `pruebas-navegador.md` | Las capturas de referencia se hicieron en Windows |
| `vercel.json`, `middleware.ts`, `lib/supabase/` | `region-y-middleware.md` | Por qué Dublín y qué paga cada navegación |

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

## Trampas que valen para todo el repo

Las de una zona concreta están en su regla (§ Reglas por zona). Estas tres no
son de ninguna:

**Sesiones en paralelo sobre el mismo árbol.** A veces hay otra sesión de Claude
Code trabajando en el mismo directorio y cambiando de rama. Comprueba
`git branch --show-current` antes de commitear, y añade rutas explícitas — nunca
`git add -A`.

**La base de datos de desarrollo es la de producción.** No hay entorno de
staging: `.env.local` apunta al proyecto real. Todo lo que se escriba lo ven los
diseñadores. Lee cuanto quieras; para escribir, pregunta.

**Ante un fallo visual, mira la pantalla antes de teorizar.** Hay matriz de
Playwright: se puede cargar una página, medir cajas, leer estilos calculados y
capturar, en cuatro motores. Un fallo de maquetación se diagnosticó en minutos
así, después de cuatro intentos fallidos razonando sobre el motor sin verlo.
