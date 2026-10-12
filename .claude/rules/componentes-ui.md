---
paths:
  - "components/**"
---

# Componentes de interfaz

**Un componente de shadcn no admite media controla.** Si expone
`defaultOpen` + `open` + `onOpenChange` y solo le pasas `onOpenChange`, avisa al
padre de cada cambio pero su estado interno nunca se mueve: se queda tieso hasta
que recargas. O usas solo `defaultOpen` (y dejas que él persista, que casi
siempre ya lo hace por cookie), o pasas `open` **y** `onOpenChange` y llevas tú
el estado. Mezclar rompe el contrato. Pasó de verdad con la sidebar, que exigía
recargar para verse el despliegue.
