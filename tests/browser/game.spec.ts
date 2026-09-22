import { test, expect } from '@playwright/test';

test('portrait drawing, pause, favorites, water and results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('formdrive.v1')) localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false }));
  });
  await page.goto('?test=1');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  await expect(page.locator('#drawing-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/test-home.png' });
  const initial = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot());
  const canvas = page.locator('#drawing-canvas'); const bounds = (await canvas.boundingBox())!;
  // Pointer events use actual browser coordinates, including an open stroke.
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  await page.mouse.move(cx + 48, cy - 20); await page.mouse.down();
  await page.mouse.move(cx - 25, cy - 53, { steps: 3 });
  await page.mouse.move(cx - 48, cy + 35, { steps: 3 }); await page.mouse.up();
  const drawn = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot());
  expect(drawn.player.revision).toBeGreaterThan(initial.player.revision);
  await page.locator('#save-shape').click();
  await page.getByRole('button', { name: 'Runde Räder', exact: true }).click();
  await page.locator('#load-shape').click();
  expect((await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot())).player.shape).toEqual(drawn.player.shape);
  await page.getByRole('button', { name: 'Runde Räder', exact: true }).click();
  await page.locator('#start-button').click();
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'racing', { timeout: 20000 });
  await page.locator('#pause-button').click();
  const paused = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().time)).toEqual(paused);
  await page.locator('#resume-game').click();
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'racing');
  await page.locator('#rescue-button').click();
  expect((await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot())).player.resets).toBeGreaterThan(0);
  await page.evaluate(() => { (window as any).__FORMDRIVE__.load(2); (window as any).__FORMDRIVE__.preset('paddle'); (window as any).__FORMDRIVE__.water(); });
  const water = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot());
  expect(water.player.x).toBeGreaterThan(20);
  expect(water.player.water).toBeGreaterThan(.1);
  await page.screenshot({ path: '.local/test-water.png' });
  await page.evaluate(() => (window as any).__FORMDRIVE__.finish());
  await expect(page.locator('#modal-title')).toHaveText(/Starke Form|Im Ziel/);
  await page.locator('#finish-home').click();
  await expect(page.locator('[data-level]')).toHaveCount(13);
  await page.locator('[data-level="0"]').click();
  expect(errors).toEqual([]);
});

test('production PWA restarts without network', async ({ page, context, browserName }) => {
  // Playwright documents Service Worker tooling as Chromium-only. Its Windows
  // WebKit runner aborts offline navigation internally, before application code.
  // https://playwright.dev/docs/service-workers
  test.skip(browserName !== 'chromium', 'Offline service-worker automation is validated in Chromium; iOS installation needs a device check.');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false })));
  await page.goto('./');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  // Validate the emitted production service worker, then reload with the network disabled.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  await expect(page.locator('#offline-status')).toHaveText(/OFFLINE BEREIT/);
  await page.screenshot({ path: '.local/test-offline.png' });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
