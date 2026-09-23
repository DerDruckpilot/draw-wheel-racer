import { test, expect } from '@playwright/test';

test('the curved route keeps the entire vehicle in the portrait camera at the three structures and on water', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Camera framing is independent of the browser renderer.');
  await page.addInitScript(() => localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco' })));
  await page.goto('?test=1'); await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  for (const width of [440, 375]) {
    await page.setViewportSize({ width, height: 956 });
    for (const id of [3, 4, 2]) {
      await page.evaluate(id => { const api = (window as any).__FORMDRIVE__; api.load(id); api.obstacle('tunnel', 300, 'compact'); }, id);
      const box = await page.evaluate(() => (window as any).__FORMDRIVE__.framing());
      expect(box.left).toBeGreaterThan(.01); expect(box.right).toBeLessThan(.99); expect(box.top).toBeGreaterThan(.1); expect(box.bottom).toBeLessThan(.8);
    }
    await page.evaluate(() => (window as any).__FORMDRIVE__.water());
    const box = await page.evaluate(() => (window as any).__FORMDRIVE__.framing());
    expect(box.left).toBeGreaterThan(.01); expect(box.right).toBeLessThan(.99);
  }
});

test('solo expedition pedals, drawing, recovery, results and old saves', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Touch-style control and layout coverage in WebKit; shared flow also runs in Chromium.');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('formdrive.v1')) localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', tutorial: true, best: { 0: { time: 12, stars: 3 } }, favorite: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }));
  });
  await page.goto('?test=1');
  await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  const snapshot = () => page.evaluate(() => (window as any).__FORMDRIVE__.snapshot());
  expect((await snapshot()).carCount).toBe(1);
  await page.locator('#start-button').click();
  await expect(page.locator('.game')).toHaveAttribute('data-state', 'racing');
  expect((await snapshot()).controls.drive).toBe(0);
  expect(await page.locator('#race-hud').innerText()).not.toMatch(/POSITION|RENNZEIT/);
  const gas = page.locator('[data-pedal="gas"]'), bounds = (await gas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  expect((await snapshot()).controls.drive).toBeCloseTo(.65);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 40);
  expect((await snapshot()).controls.drive).toBe(1);
  await page.mouse.up(); expect((await snapshot()).controls.drive).toBe(0);
  await page.locator('#cruise-button').click(); expect((await snapshot()).controls.cruise).toBe(true);
  const brake = (await page.locator('[data-pedal="brake"]').boundingBox())!;
  await page.mouse.move(brake.x + 25, brake.y + 20); await page.mouse.down();
  expect((await snapshot()).controls).toEqual({ drive: 0, brake: 1, cruise: false });
  await page.mouse.up();
  const reverse = (await page.locator('[data-pedal="reverse"]').boundingBox())!;
  await page.mouse.move(reverse.x + 20, reverse.y + 20); await page.mouse.down();
  expect((await snapshot()).controls.drive).toBeLessThan(0);
  await page.locator('[data-pedal="reverse"]').dispatchEvent('pointercancel', { pointerId: 1 });
  expect((await snapshot()).controls.drive).toBe(0); await page.mouse.up();
  // The driving input survives a simultaneous, independent drawing gesture.
  await page.keyboard.down('ArrowRight');
  const revision = (await snapshot()).player.revision;
  const pad = (await page.locator('#drawing-canvas').boundingBox())!;
  await page.mouse.move(pad.x + 90, pad.y + 80); await page.mouse.down();
  await page.mouse.move(pad.x + 220, pad.y + 80, { steps: 4 }); await page.mouse.up();
  await expect.poll(async () => (await snapshot()).player.revision).toBeGreaterThan(revision);
  expect((await snapshot()).controls.drive).toBe(1); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space'); expect((await snapshot()).controls.brake).toBe(1); await page.keyboard.up('Space');
  await page.locator('#cruise-button').click(); await page.locator('#pause-button').click();
  expect((await snapshot()).controls).toEqual({ drive: 0, brake: 0, cruise: false });
  await page.locator('#resume-game').click(); expect((await snapshot()).controls.drive).toBe(0);
  for (const [width, height] of [[440, 956], [375, 667], [956, 440]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.querySelector('.game')!.getBoundingClientRect().width)).toBe(Math.min(width, height < 600 ? width : 620));
    const layout = await page.evaluate(() => {
      const pad = document.querySelector('#drawing-canvas')!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLButtonElement>('#drive-controls button')].map(b => { const r = b.getBoundingClientRect(); return { x: r.x, bottom: r.bottom, top: r.top, right: r.right, height: r.height, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === b, padBottom: pad.bottom }; });
    });
    for (const b of layout) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(width); expect(b.bottom).toBeLessThanOrEqual(height); expect(b.height).toBeGreaterThanOrEqual(44); expect(b.top).toBeGreaterThan(b.padBottom); expect(b.hit).toBe(true); }
  }
  await page.setViewportSize({ width: 440, height: 956 });
  await page.locator('#rescue-button').click(); expect((await snapshot()).player.resets).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__FORMDRIVE__.finish());
  await expect(page.locator('#modal-title')).toHaveText('Im Lager angekommen.');
  await expect(page.locator('.mission-results')).toContainText('Ziellager erreicht');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!));
  expect(saved.best[0]).toEqual({ time: 12, stars: 3 }); expect(saved.expeditions[0].completed).toBe(true); expect(saved.expeditions[0].noRescue).toBe(false);
  expect(saved.favorite).toEqual([{ x: -1, y: 0 }, { x: 1, y: 0 }]);
  await page.reload(); await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 40000 });
  await page.locator('#choose-course').click(); await expect(page.locator('[data-level="0"]')).toContainText('GESCHAFFT');
  expect(errors).toEqual([]);
});
