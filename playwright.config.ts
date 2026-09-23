import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 180000, workers: 1,
  use: { baseURL: process.env.GAME_URL || 'http://127.0.0.1:4173/draw-wheel-racer/', viewport: { width: 956, height: 440 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
  reporter: 'list',
  // Software WebGL in Chromium needs more time for the full-height scene.
  projects: [{ name: 'chromium', timeout: 240000, use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit', launchOptions: {} } }]
});
