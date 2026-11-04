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

**El aviso de «Instala PHSPORT» también es `role="dialog"`.** Una prueba en móvil
que cuente diálogos lo cuenta a él, y parecerá que una hoja no se cierra. Busca la
hoja por algo suyo. Además tapa la parte baja de la pantalla: ciérralo antes de
pulsar lo que quede ahí.

**Una franja vacía de 11 px a la derecha en una captura de iPhone no es que algo
se salga de ancho.** Sale en algunas capturas de WebKit, también en pantallas sin
tocar. Antes de buscar el culpable, mide: `scrollWidth` y quién pasa de 393.

**Para repetir pruebas con la sesión guardada,** sin volver a iniciar sesión:
`PLAYWRIGHT_USER=x PLAYWRIGHT_PASS=x npx playwright test <archivo> --no-deps`. Los
valores solo encienden las pruebas con sesión; quien entra es `e2e/.sesion/usuario.json`.
