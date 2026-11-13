// Netlify Function (v2) serving /api/*: accounts and progress sync, stored in Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { handle, type KV } from '../../server/core.ts';

function blobsKV(name: string): KV {
  const store = getStore({ name, consistency: 'strong' });
  return {
    async get(key) {
      const r = await store.getWithMetadata(key, { type: 'json' });
      return r ? { data: r.data, etag: r.etag } : null;
    },
    async set(key, value, cond) {
      const opts = cond?.onlyIfNew ? { onlyIfNew: true } : cond?.onlyIfMatch ? { onlyIfMatch: cond.onlyIfMatch } : {};
      const res = await store.setJSON(key, value, opts);
      return res.modified;
    },
  };
}

export default async (req: Request) =>
  handle(req, {
    secret: process.env.SESSION_SECRET,
    users: blobsKV('users'),
    progress: blobsKV('progress'),
  });

export const config = { path: '/api/*' };
