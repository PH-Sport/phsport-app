import { test, expect } from '@playwright/test';
import { RUTA_SESION } from './sesion-ruta';

/**
 * El campograma, solo lo que no depende de quién esté en la cartera: aquí no se
 * compara ningún nombre ni se guardan capturas, porque el repositorio es público
 * y la cartera lleva datos de menores.
 */

const haySesion = Boolean(process.env.PLAYWRIGHT_USER && process.env.PLAYWRIGHT_PASS);

test.describe('Campograma', () => {
  test.skip(!haySesion, 'Requiere sesión: define PLAYWRIGHT_USER y PLAYWRIGHT_PASS.');
  test.use({ storageState: haySesion ? RUTA_SESION : undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/campograma');
    await expect(page.locator('[data-position]')).toHaveCount(11);
  });

  test('un disco abre su lista, se entra en una ficha y se vuelve', async ({ page }) => {
    await page.locator('[data-position]:has(b)').first().click();
    const filas = page.locator('[data-player]');
    await expect(filas.first()).toBeVisible();
    const cuantas = await filas.count();

    await filas.first().click();
    await expect(page.getByRole('dialog').locator('dl')).toBeVisible();

    await page.getByRole('button', { name: /^Volver a/ }).click();
    await expect(filas).toHaveCount(cuantas);

    await page.keyboard.press('Escape');
    await expect(filas).toHaveCount(0);
  });

  test('la vista Lista enseña filas y se vuelve al campo', async ({ page }) => {
    await page.getByRole('tab', { name: 'Lista' }).click();
    await expect(page.locator('[data-position]')).toHaveCount(0);
    await expect(page.locator('[data-list-row]:visible, [data-table-row]:visible').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Campo' }).click();
    await expect(page.locator('[data-position]')).toHaveCount(11);
  });

  test('una búsqueda sin coincidencias apaga los discos y lo dice', async ({ page }) => {
    const lupa = page.getByRole('button', { name: 'Buscar', exact: true });
    if (await lupa.isVisible()) await lupa.click();
    await page.getByRole('searchbox').fill('zzzzzz');

    await expect(page.locator('[data-no-results]')).toBeVisible();
    await expect(page.locator('[data-position]:disabled')).toHaveCount(11);
  });
});
