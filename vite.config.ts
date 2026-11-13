import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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
  plugins: [react(), devApi()],
});
