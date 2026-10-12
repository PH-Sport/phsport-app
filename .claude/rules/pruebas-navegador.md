---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# Pruebas de navegador

La matriz de motores, qué cubre cada uno y cómo se regeneran las capturas están
en `docs/testing-navegadores.md`. Lo que no está ahí:

**Las capturas de referencia se hicieron en Windows.** Las dos que hay en
`e2e/__capturas__/` se generaron en la máquina de Windows de Mario. macOS y Linux
dibujan las tipografías de otra forma, así que **en otro sistema esos dos tests
fallan sin que haya ningún fallo real**. No es una regresión: es la línea base,
que es específica del sistema. Si se trabaja desde otro equipo, comparar el
diff visual a ojo y, si solo cambia el grosor del texto, regenerarlas ahí con
`npm run e2e:capturas` — asumiendo que a partir de entonces fallarán en Windows.
