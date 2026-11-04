import { test, expect, type Page } from '@playwright/test';
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

/**
 * Con una cartera inventada, servida en lugar de la de verdad: es la forma de probar
 * lo que hoy ningún jugador real dispara, sin datos de nadie en el repositorio.
 */
const CATEGORIAS = [
  { id: 'cat_a', name: 'Categoría A', short_name: 'Cat A', coach: null },
  { id: 'cat_b', name: 'Categoría B', short_name: 'Cat B', coach: null },
];
const jugador = (fila: Record<string, unknown>) => ({
  birth_year: 2003,
  owner_club: 'Club Inventado',
  situation: null,
  loaned_to: null,
  photo_url: null,
  deactivated_at: null,
  ...fila,
});
const JUGADORES = [
  jugador({ id: 'a1', name: 'Prueba Alfa', position: 'MC', category_id: 'cat_a' }),
  jugador({ id: 'a2', name: 'Prueba Sin Datos', birth_year: null, owner_club: null, position: 'DEL', category_id: 'cat_a' }),
  jugador({ id: 'b1', name: 'Prueba Beta', position: 'MC', category_id: 'cat_b' }),
];

async function conCarteraInventada(page: Page) {
  await page.route('**/rest/v1/portfolio_players*', (ruta) => ruta.fulfill({ json: JUGADORES }));
  await page.route('**/rest/v1/portfolio_categories*', (ruta) => ruta.fulfill({ json: CATEGORIAS }));
  await page.goto('/campograma');
  await expect(page.locator('[data-position]')).toHaveCount(11);
}

test.describe('Campograma, con una cartera inventada', () => {
  test.skip(!haySesion, 'Requiere sesión: define PLAYWRIGHT_USER y PLAYWRIGHT_PASS.');
  test.use({ storageState: haySesion ? RUTA_SESION : undefined });

  test('sin año ni club se lee «sin confirmar», sin huecos', async ({ page }) => {
    await conCarteraInventada(page);
    await page.locator('[data-position="DEL"]').click();
    await expect(page.locator('[data-player]').getByText('sin confirmar')).toHaveCount(2);
    await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: 'Lista' }).click();
    const fila = page.locator('[data-list-row]:visible, [data-table-row]:visible').filter({ hasText: 'Prueba Sin Datos' });
    await expect(fila.getByText('sin confirmar')).toHaveCount(2);
  });

  test('un fallo al revalidar no tapa la cartera ya cargada', async ({ page }) => {
    await conCarteraInventada(page);
    await page.unroute('**/rest/v1/portfolio_players*');
    await page.route('**/rest/v1/portfolio_players*', (ruta) => ruta.abort());

    // SWR no vuelve a pedir nada hasta pasados cinco segundos de la última vez.
    await page.waitForTimeout(5500);
    const peticion = page.waitForRequest('**/rest/v1/portfolio_players*');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await peticion;
    await page.waitForTimeout(500);

    await expect(page.getByText('No se pudo cargar la cartera')).toHaveCount(0);
    await expect(page.locator('[data-position]')).toHaveCount(11);
  });

  test('buscando en móvil, avisa de las coincidencias de otra categoría', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Desde lg las pestañas ya dicen cuántas hay en cada una.');
    await conCarteraInventada(page);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('searchbox').fill('prueba');

    await expect(page.locator('[data-no-results]')).toHaveCount(0);
    await page.locator('[data-jump="cat_b"]').click();
    await expect(page.locator('[data-position="MC"]')).toBeEnabled();
    await expect(page.locator('[data-position="DEL"]')).toBeDisabled();
  });

  // Safari de iOS solo saca el teclado si el foco llega dentro del propio toque.
  test('la lupa deja el foco en el campo en el mismo toque', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'En escritorio el buscador ya está abierto.');
    await conCarteraInventada(page);
    const enfocado = await page.evaluate(() => {
      const lupa = document.querySelector<HTMLButtonElement>('button[aria-label="Buscar"]');
      lupa?.click();
      return document.activeElement?.getAttribute('type');
    });
    expect(enfocado).toBe('search');
  });
});

