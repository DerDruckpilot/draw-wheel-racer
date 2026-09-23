import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';

test('an update installed during the first visit reloads only after confirmation and keeps saves', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright service-worker lifecycle verification uses Chromium.');
  let release = 1;
  const root = resolve('dist');
  const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.txt': 'text/plain' };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname);
      if (!path.startsWith('/draw-wheel-racer/')) { res.writeHead(404).end(); return; }
      const file = resolve(root, path.slice('/draw-wheel-racer/'.length) || 'index.html');
      if (relative(root, file).startsWith('..')) { res.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      // Different SW bytes reproduce a deployment without mocking the browser's
      // controller/waiting events or replacing the actual Workbox application.
      res.end(path.endsWith('/sw.js') ? Buffer.concat([bytes, Buffer.from(`\n// Release ${release}\n`)]) : bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  try {
    await page.addInitScript(() => {
      (window as any).__visit = crypto.randomUUID();
      if (!localStorage.getItem('formdrive.v1')) localStorage.setItem('formdrive.v1', JSON.stringify({ quality: 'eco', sound: false, favorite: [{x:-1,y:0},{x:1,y:0}], expeditions: {0:{completed:true,noRescue:true,allCaches:false,fewestRescues:0}} }));
    });
    const port = (server.address() as { port: number }).port;
    await page.goto(`http://127.0.0.1:${port}/draw-wheel-racer/`);
    await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 60000 });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const favorite = await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!).favorite);
    const visit = await page.evaluate(() => (window as any).__visit);
    release = 2;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
    expect(await page.evaluate(() => (window as any).__visit)).toEqual(visit);
    await page.locator('#settings-button').click();
    await expect(page.locator('#apply-update')).toBeVisible();
    await page.locator('#apply-update').click();
    await page.waitForFunction(before => !!(window as any).__visit && (window as any).__visit !== before, visit, { timeout: 60000 });
    await expect(page.locator('#start-button')).toHaveText(/Motor starten/, { timeout: 60000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('formdrive.v1')!).favorite)).toEqual(favorite);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(r => server.close(() => r()));
  }
});
