import { test, expect } from '@playwright/test';

test('long drawing prepares in a worker, saves exactly and can be superseded', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Touch drawing and the worker flow are covered in WebKit.');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false })));
  await page.goto('?test=1');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  const draw = (supersede = false) => page.evaluate((supersede) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#drawing-canvas')!, rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width * .44, rect.height * .43) / 1.2;
    for (let i = 0; i <= 1440; i++) {
      const a = i / 160 * Math.PI * 2, r = .2 + .9 * i / 1440;
      canvas.dispatchEvent(new PointerEvent(i === 0 ? 'pointerdown' : i === 1440 ? 'pointerup' : 'pointermove', { pointerId: 1, pointerType: 'touch', button: 0, buttons: i === 1440 ? 0 : 1, clientX: rect.x + rect.width / 2 + Math.cos(a) * r * scale, clientY: rect.y + rect.height / 2 - Math.sin(a) * r * scale, bubbles: true }));
    }
    const pending = canvas.getAttribute('aria-busy') === 'true';
    // Same event task: no worker message can arrive before this newer input.
    if (supersede) document.querySelector<HTMLButtonElement>('[data-shape="round"]')!.click();
    else document.querySelector<HTMLButtonElement>('#save-shape')!.click();
    return pending;
  }, supersede);
  // A real captured pointer is established before dispatching the dense samples.
  const bounds = (await page.locator('#drawing-canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.up();
  const before = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.revision);
  expect(await draw()).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!).favorite.length)).toBeGreaterThan(128);
  await expect.poll(() => page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.revision), { timeout: 20000 }).toBeGreaterThan(before);
  const mounted = await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.shape);
  expect(mounted).toBeGreaterThan(128);
  await page.locator('#save-shape').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!).favorite);
  expect(saved.length).toBe(mounted);
  await page.getByRole('button', { name: 'Runde Räder', exact: true }).click();
  await page.locator('#load-shape').click();
  await expect.poll(() => page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.shape)).toBe(mounted);
  expect(await draw(true)).toBe(true);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as any).__FORMDRIVE__.snapshot().player.shape)).toBeLessThan(128);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!).favorite)).toEqual(saved);
  expect(errors).toEqual([]);
});
