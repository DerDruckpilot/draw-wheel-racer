import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 180000, workers: 1,
  use: { baseURL: process.env.GAME_URL || 'http://127.0.0.1:4173/draw-wheel-racer/', viewport: { width: 440, height: 956 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, launchOptions: { args: ['--enable-unsafe-swiftshader'] } },
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit', launchOptions: {} } }]
});
