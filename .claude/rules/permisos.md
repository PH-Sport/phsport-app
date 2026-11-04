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

**La cuenta de desarrollador (`is_dev`) es admin absoluto** (migración 053):
todos los departamentos y todos los permisos que tenga algún rol, menos
`recibir_asignaciones`, sin tener rol en ellos. Lo deciden `has_permission`,
`in_department` e `is_staff` en la base y `deriveAccess` en la app: si cambias
uno, cambia el otro. La marca solo se pone desde el panel de Supabase; no abras
nunca una vía para escribirla desde el cliente (columna, función, ruta o una
política de INSERT en `profiles`, que hoy no tiene), porque es la llave de todo.

**La cartera de Agentes** (`portfolio_*`, migración 051): verla, dar de alta y
editar es de todo el departamento (`in_department(…, 'agentes')`); dar de baja
y recuperar es `dar_de_baja_jugadores`, de Director. Esa diferencia la guarda un
trigger, no la RLS, porque la RLS no distingue columnas. Creativo solo llega a
`portfolio_names()` (nombre y equipo).
