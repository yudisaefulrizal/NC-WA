import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

export function apiKeyAuth(key: string): RequestHandler {
  if (!key.trim()) throw new Error('API_KEY wajib diisi');
  const expected = Buffer.from(key);
  return (req, res, next) => {
    // EventSource tidak bisa mengirim header, jadi /events juga menerima ?key=.
    const query = req.path === '/events' && typeof req.query.key === 'string' ? req.query.key : '';
    const provided = Buffer.from(req.get('X-API-Key') ?? query);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ error: 'unauthorized', message: 'API key salah atau tidak ada' });
      return;
    }
    next();
  };
}
