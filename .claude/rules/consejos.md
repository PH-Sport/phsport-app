---
paths:
  - "lib/help/**"
  - "components/ui/tip.tsx"
  - "components/ui/help-hint.tsx"
  - "app/(dashboard)/ayuda/**"
---

# Consejos y ayuda

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

Dos criterios, y los dos son de descarte. **Entra** si explica algo que la
pantalla no puede decir sola y que, sin saberlo, lleva a una conclusión
equivocada: «pulsa el botón para abrir el diálogo» no entra. Y **cabe en una
frase, dos como mucho**: si necesita más, hay dos consejos metidos en uno.
