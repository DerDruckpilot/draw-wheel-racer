import { test, expect } from '@playwright/test';
import sharp from 'sharp';

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
  await page.getByRole('button', { name: 'Gezackte Räder', exact: true }).click();
  await expect(page.locator('[data-shape="grip"]')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Kleine Räder für Durchfahrten', exact: true }).click();
  await expect(page.locator('[data-shape="compact"]')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Runde Räder', exact: true }).click();
  await page.locator('#settings-button').click();
  await expect(page.locator('.version')).toContainText('FORMDRIVE 1.5.0');
  await page.locator('#close-modal').click();
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
  expect(water.spray.count).toBeGreaterThan(100);
  expect(water.spray.strengths[0]).toBeGreaterThan(.2);
  await page.screenshot({ path: '.local/test-water.png' });
  await page.evaluate(() => (window as any).__FORMDRIVE__.finish());
  await expect(page.locator('#modal-title')).toHaveText(/Im Lager angekommen/);
  await page.locator('#finish-home').click();
  await expect(page.locator('[data-level]')).toHaveCount(13);
  await page.locator('[data-level="0"]').click();
  expect(errors).toEqual([]);
});

test('floating drawing controls leave the full world visible at phone sizes and after rotation', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Mobile layout is checked with WebKit; the main flow covers both engines.');
  await page.addInitScript(() => localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false })));
  await page.goto('?test=1');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  for (const [width, height] of [[440, 956], [390, 844], [375, 667], [956, 440]]) {
    const before = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().render.frame);
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().render.frame), { timeout: 15000 }).toBeGreaterThan(before + 1);
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      const field = document.querySelector('.drawing-field')!, background = getComputedStyle(field).backgroundColor;
      const canvas = rect('#drawing-canvas'), panel = rect('.draw-panel'), stage = rect('#scene'), game = rect('.game');
      const hit = document.elementFromPoint(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)?.id;
      return { canvas, panel, stage, game, background, hit, scroll: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.draw-tools button,.presets button')].map(b => b.getBoundingClientRect().toJSON()) };
    });
    expect(layout.stage.height).toBe(layout.game.height);
    expect(layout.canvas.height).toBeGreaterThanOrEqual(125);
    expect(layout.panel.bottom).toBeLessThanOrEqual(height);
    expect(layout.panel.x).toBeGreaterThanOrEqual(0);
    expect(layout.hit).toBe('drawing-canvas');
    expect(layout.scroll).toBeLessThanOrEqual(width);
    expect(layout.background).toMatch(/^rgba\(.+, 0\.[12]\d*\)$/);
    for (const button of layout.buttons) {
      expect(button.bottom).toBeLessThanOrEqual(height);
      expect(button.height).toBeGreaterThanOrEqual(40);
    }
    // Windows WebKit's screenshot compositor can lose the WebGL layer after
    // an emulated resize, although the drawing buffer keeps rendering. Check
    // that buffer directly, then use a fresh document for the visual artifact.
    const scene = await page.evaluate(() => (window as any).__FORMDRIVE__.sceneImage());
    const buffer = Buffer.from(scene.split(',')[1], 'base64');
    const stats = await sharp(buffer).stats();
    expect(stats.channels.slice(0, 3).some(c => c.stdev > 15)).toBe(true);
    await sharp(buffer).toFile(`.local/scene-1.4-${width}x${height}.png`);
    await page.reload();
    await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
    await expect.poll(() => page.evaluate(() => (window as any).__FORMDRIVE__?.snapshot().render.frame ?? 0)).toBeGreaterThan(2);
    await page.screenshot({ path: `.local/layout-1.4-${width}x${height}.png` });
  }
});

test('countdown uses elapsed time when rendering has a low frame rate', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'One controlled renderer is sufficient for the UI clock regression.');
  await page.addInitScript(() => {
    localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false }));
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 350);
  });
  await page.goto('./');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  await page.locator('#start-button').click();
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'racing', { timeout: 6500 });
});

test('production PWA restarts without network', async ({ page, context, browserName }) => {
  // Playwright documents Service Worker tooling as Chromium-only. Its Windows
  // WebKit runner aborts offline navigation internally, before application code.
  // https://playwright.dev/docs/service-workers
  test.skip(browserName !== 'chromium', 'Offline service-worker automation is validated in Chromium; iOS installation needs a device check.');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false })));
  await page.goto('?test=1');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  // Validate the emitted production service worker, then reload with the network disabled.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  await expect(page.locator('#offline-status')).toHaveText(/OFFLINE BEREIT/);
  // The geometry worker has never run in this session. It too must come from
  // the production precache when a detailed contour is first drawn offline.
  const bounds = (await page.locator('#drawing-canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.up();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#drawing-canvas')!, rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width * .44, rect.height * .43) / 1.2;
    for (let i = 0; i <= 448; i++) {
      const a = i / 448 * Math.PI * 2, r = .8 + .13 * Math.sin(a * 112);
      canvas.dispatchEvent(new PointerEvent(i === 0 ? 'pointerdown' : i === 448 ? 'pointerup' : 'pointermove', { pointerId: 1, button: 0, buttons: i === 448 ? 0 : 1, clientX: rect.x + rect.width / 2 + Math.cos(a) * r * scale, clientY: rect.y + rect.height / 2 - Math.sin(a) * r * scale, bubbles: true }));
    }
  });
  await expect.poll(() => page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.shape), { timeout: 30000 }).toBeGreaterThan(128);
  await page.screenshot({ path: '.local/test-offline.png' });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
