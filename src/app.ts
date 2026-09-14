import express from 'express';
import { ApiError, type SessionManager } from './sessions.js';

export function createApp(manager: SessionManager) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
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
