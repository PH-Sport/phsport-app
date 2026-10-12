---
paths:
  - "supabase/**"
---

# Migraciones y base de datos

**El historial de migraciones diverge de los archivos locales.** Hay números
duplicados y migraciones aplicadas a mano que no constan en el registro de
Supabase. Antes de escribir DDL: mira el número real con un `ls` de la carpeta e
**inspecciona el estado vivo de la base** (`pg_policies`, `pg_trigger`,
`pg_get_functiondef`) en vez de fiarte de los archivos.

**Producción y preview comparten base, y `main` va por detrás.** Una migración
que quite una columna que `main` todavía lee tumba producción. Por eso las
migraciones se parten en «añadir» (se aplican cuando se escriben) y «quitar»
(esperan al merge): la que borra el rol antiguo (hoy numerada 049) es el
ejemplo. Antes de escribir DDL que borre algo, mirar qué lee `main` con
`git grep <columna> main -- app lib components`.

**Una política del cubo que consulte `player_files` tiene que decir
`storage.objects.name`, con apellido.** Las dos tablas tienen una columna
`name`; dentro del `exists (… from player_files f where …)` un `name` a secas
es `f.name`, la política compila, Postgres la deparsea sin quejarse y queda
muerta (pasó en la 046; lo sacó una revisión, no un error). Al escribir o
cambiar una política de `storage.objects`, leerla de vuelta en `pg_policies`
y buscar `f.name`. Y probarla **como jugador**: una sesión simulada de la
agencia no la ejercita (receta en el §4 de septiembre de
`docs/estado-y-traspaso.md`).
