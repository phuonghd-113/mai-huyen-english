import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { handle, memoryKV } from './server/core.ts';

/**
 * `npm run dev` serves /api/* with the same code as the Netlify Function,
 * storing data in .dev-data/api.json instead of Netlify Blobs.
 */
function devApi(): Plugin {
  const file = '.dev-data/api.json';
  let seed = new Map<string, { data: unknown; etag: string }>();
  try {
    seed = new Map(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    /* first run */
  }
  const save = () => {
    mkdirSync('.dev-data', { recursive: true });
    writeFileSync(file, JSON.stringify([...seed.entries()]));
  };
  const users = memoryKV(seed, save);
  const progress = memoryKV(seed, save);
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const request = new Request(`http://localhost/api${req.url ?? ''}`, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
        });
        const response = await handle(request, {
          secret: process.env.SESSION_SECRET ?? 'dev-only-secret-not-for-production-0000',
          users,
          progress,
        });
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    // Offline: the app shell and every exam paper are precached; progress already lives in localStorage
    // and syncs when the network returns. A new version waits for the student to tap "Cập nhật",
    // so a paper in progress is never reloaded under them.
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Ôn thi HSG tiếng Anh 8',
        short_name: 'Ôn HSG Anh 8',
        description: 'Thi thử, luyện theo dạng bài, sổ lỗi sai và từ vựng Destination B1.',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f9fa',
        theme_color: '#f7f9fa',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // take control of the page on first install, so a later update can reload it (skipWaiting stays manual)
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 86400 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
