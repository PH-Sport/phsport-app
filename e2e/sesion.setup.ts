import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { RUTA_SESION } from './sesion-ruta';

/**
 * Inicia sesión una vez y guarda la sesión en disco, para que los tests que
 * necesitan el dashboard no pasen por el formulario cada vez.
 *
 * Credenciales por entorno, nunca en el repo:
 *   PLAYWRIGHT_USER=...  PLAYWRIGHT_PASS=...  npx playwright test
 *
 * Sin ellas, este setup no falla: deja marcado que no hay sesión y los tests
 * que la piden se saltan con un motivo legible. Así la matriz sigue siendo útil
 * para todo lo que no requiere estar dentro (login, offline, arranque).
 *
 * Usa una cuenta DE PRUEBA, no la tuya: los tests navegan y podrían escribir.
 */

setup('iniciar sesión', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_USER;
  const pass = process.env.PLAYWRIGHT_PASS;

  if (!email || !pass) {
    setup.skip(true, 'Sin PLAYWRIGHT_USER / PLAYWRIGHT_PASS: se omiten los tests con sesión.');
    return;
  }

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(pass);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();

  // El destino depende de la cara que ve la cuenta (mánager → /inicio,
  // diseñador → /mi-semana, jugador → /area-personal), así que esperamos a
  // salir de /login en vez de a una ruta concreta.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  fs.mkdirSync(path.dirname(RUTA_SESION), { recursive: true });
  await page.context().storageState({ path: RUTA_SESION });
});
