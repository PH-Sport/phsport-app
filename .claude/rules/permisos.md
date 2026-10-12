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

**Los permisos de Agentes van aparte de los de creativo** (`invitar_agentes`,
`gestionar_agentes`), porque `gestionar_roles` abre también borrar cuentas, la
auditoría y los avisos, y un director no debe tener nada de eso. Repartir un rol
se hace **por departamento**, con `set_department_role`; `set_profile_roles`
reemplaza todos los roles de la persona y borraría los del otro departamento, así
que la app no lo llama. Qué ruta es de qué departamento lo dice
`lib/utils/navigation.ts`, y de ahí salen la navegación y la puerta de cada
pantalla.
