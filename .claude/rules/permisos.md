---
paths:
  - "lib/utils/access.ts"
  - "lib/auth/**"
  - "app/api/**"
  - "supabase/migrations/**"
---

# Permisos

**Los permisos se definen en un solo sitio: `lib/utils/access.ts`.** La base
guarda qué roles hay y qué permisos tiene cada uno, y eso solo lo cambia una
migración (decisión de Mario: sin pantalla de roles); el código dice qué
permisos existen, y Ajustes → Miembros solo elige el rol de cada persona. Para
preguntar «¿puede?»: en cliente `useAuth().access.can('…')`, en rutas de API
`loadAccess(supabase, userId)`, y en la base `has_permission(uid, '…')` dentro
de las políticas. Nunca comparar nombres de rol: un rol se puede renombrar.
