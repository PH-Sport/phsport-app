# PHSPORT Dashboard

Dashboard interno del equipo de diseño de PHSPORT: se reparte el trabajo entre
diseñadores, con fecha de entrega, y se marca como entregado. Aplicación web
instalable (PWA), en castellano.

> **¿Vas a trabajar en el código?** Empieza por `CLAUDE.md` (cómo se trabaja) y
> `docs/estado-y-traspaso.md` (dónde está cada cosa y qué queda pendiente).

## Qué hace

**Diseños.** Lista con filtros y vista de calendario. Estado binario: pendiente →
entregado. Alta en lote desde un taller de tarjetas, con un agente conversacional
que interpreta el encargo en lenguaje natural y lo convierte en tarjetas.

**Reparto.** Asignación automática ponderada por la carga de cada diseñador en la
semana a la que pertenece cada entrega, y reasignación manual desde el detalle.

**Vistas por rol.** Mánager: dashboard de equipo, carga y vencimientos. Diseñador:
«Mi semana», con lo pendiente y lo entregado agrupado por semanas.

**Avisos.** Notificaciones dentro de la app, por correo y push, cuando te asignan
trabajo o se acerca una entrega.

**Equipo y ajustes.** Alta por invitación, roles, perfil, preferencias de aviso y
tema claro/oscuro que sigue al dispositivo.

**Ayuda.** Consejos sobre lo que la app hace por debajo y la pantalla no puede
decir sola —el alcance de cada vista, cómo pondera el reparto, qué se guarda por
dispositivo—. Salen donde surge la duda, con un «?» o un aviso descartable, y se
leen seguidos en `/ayuda`.

## Stack

- **Frontend:** Next.js 15 (App Router), React 18, TypeScript
- **Estilos:** Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Supabase — PostgreSQL con RLS, Auth, Realtime, Storage, Edge Functions
- **IA:** Claude (Anthropic) para el agente de alta de diseños
- **Tests:** Vitest (unidad) y Playwright (navegador)

## Puesta en marcha

Requiere **Node 22** (hay `.nvmrc`) y acceso al proyecto de Supabase.

```bash
nvm use                    # o instalar Node 22 a mano
npm install
npx playwright install     # solo si vas a ejecutar tests de navegador
cp .env.example .env.local # y rellenar
npm run dev
```

`.env.local` no está versionado y **no se puede reconstruir desde aquí**: las
claves hay que copiarlas de otra máquina o sacarlas de los paneles. Los valores y
de dónde sale cada uno están en `docs/operaciones-y-entorno.md`.

> **No hay entorno de staging:** la configuración local apunta a la base de datos
> de producción. Lo que se escriba lo ven los diseñadores.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `localhost:3000` |
| `npm run build` / `npm start` | Build de producción y arrancarlo |
| `npm test` | Tests unitarios (Vitest) |
| `npm run e2e` | Tests de navegador (Playwright) — ver `docs/testing-navegadores.md` |
| `npm run type-check` | Valida tipos sin compilar |
| `npm run lint` | ESLint |

Medir rendimiento o pintado **siempre** sobre `build` + `start`, nunca sobre
`dev`.

## Estructura

```
app/
  (auth)/           login, invitación, restablecer contraseña
  (dashboard)/      inicio · mi-semana · disenos · equipo · ajustes · ayuda
  api/designs/      rutas de servidor (validación zod en lib/api/schemas.ts)
components/
  ui/               sistema de diseño propio (Surface, Row, PulseDot…) + shadcn
  layout/           shell: cabecera, sidebar, barra de pestañas móvil
  features/         componentes de negocio por dominio
lib/
  hooks/            datos vía SWR
  help/             catálogo de consejos (fuente única) + su lógica pura
  utils/            lógica pura — aquí viven los tests
  services/designs/ reparto, agente de alta
  supabase/         clientes de navegador y servidor
supabase/
  migrations/       SQL numerado
  functions/        Edge Functions
e2e/                Playwright
docs/               estado del proyecto, planes y auditorías
```

## Documentación

| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Convenciones y trampas conocidas |
| `docs/estado-y-traspaso.md` | Dónde está cada cosa, decisiones y pendientes |
| `docs/operaciones-y-entorno.md` | Cuentas, claves, correo y DNS: lo que no vive en el código |
| `docs/testing-navegadores.md` | Matriz de Playwright y lo que **no** cubre |
| `docs/inventario-estado-actual.md` | Mapa capa por capa (junio 2026) |
