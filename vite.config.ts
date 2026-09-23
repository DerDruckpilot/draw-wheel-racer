import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/draw-wheel-racer/',
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['licenses/*.txt'],
    manifest: {
      id: '/draw-wheel-racer/', name: 'FORMDRIVE — Zeichne deinen Weg', short_name: 'FORMDRIVE',
      description: 'Ein Physik-Abenteuer. Zeichne deine Räder. Bezwinge Fels, Eis und Wasser.',
      lang: 'de', theme_color: '#18201e', background_color: '#18201e',
      display: 'standalone', orientation: 'portrait', start_url: '/draw-wheel-racer/', scope: '/draw-wheel-racer/',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,wasm,png,jpg,webp,glb,gltf,bin,svg,woff2,json,hdr}'],
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      clientsClaim: true,
      dontCacheBustURLsMatching: /-[a-zA-Z0-9_-]{8}\.(?:js|css)$/,
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true
    }
  })],
  build: { chunkSizeWarningLimit: 2200 }
});
