import type { MediaStore } from './media.js';
import express from 'express';
import { sendText, sendMedia } from './messages.js';
import { apiKeyAuth } from './auth.js';
import { fileURLToPath } from 'node:url';
import { ApiError, type SessionManager } from './sessions.js';

export function createApp(manager: SessionManager, apiKey: string, media?: MediaStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use(apiKeyAuth(apiKey));
  app.use(express.json({ limit: '64kb' }));
  app.get('/media/:id', async (req, res) => {
    if (!media) throw new ApiError(404, 'media_not_found', 'Media tidak ada');
    const file = await media.get(req.params.id);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
    res.sendFile(file.path);
  });
  app.post('/sessions/:id/messages/media', async (req, res) => res.json(await sendMedia(manager, req.params.id, req.body)));
  app.post('/sessions/:id/messages/text', async (req, res) => res.json(await sendText(manager, req.params.id, req.body)));
  app.post('/sessions', async (req, res) => {
    const { id, status } = await manager.create(req.body?.id);
    res.json({ id, status });
  });
  app.get('/sessions', (_req, res) => res.json(manager.list().map(({ id, status, phone }) => ({ id, status, phone }))));
  app.get('/sessions/:id', (req, res) => res.json(manager.detail(req.params.id)));
  app.post('/sessions/:id/logout', async (req, res) => res.json(await manager.logout(req.params.id)));
  app.delete('/sessions/:id', async (req, res) => res.json(await manager.remove(req.params.id)));
  app.get('/sessions/:id/qr', (req, res) => res.json(manager.qr(req.params.id)));
  app.use((_req, _res, next) => next(new ApiError(404, 'not_found', 'Endpoint tidak ada')));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: error.code, message: error.message }); return; }
    const status = (error as { status?: number })?.status;
    if (status === 400 || status === 413) {
      res.status(status).json({ error: 'invalid_request', message: status === 413 ? 'Body terlalu besar' : 'JSON tidak valid' }); return;
    }
    console.log(`${new Date().toISOString()} Error saat menangani request`);
    res.status(500).json({ error: 'internal_error', message: 'Terjadi kesalahan internal' });
  });
  return app;
}
