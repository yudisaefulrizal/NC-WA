import { log } from './log.js';
import { MediaStore } from './media.js';
import { Webhook } from './webhook.js';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { baileysConnector } from './baileys.js';
import { SessionManager } from './sessions.js';
import { SessionStore } from './store.js';

const apiKey = process.env.API_KEY ?? '';
if (!apiKey.trim()) throw new Error('API_KEY wajib diisi di .env');
const port = Number(process.env.PORT ?? 8066);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT harus 1–65535');
const store = new SessionStore(resolve(process.env.AUTH_DIR ?? 'auth'));
const intervalMs = Number(process.env.SEND_INTERVAL_MS ?? 1000);
if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new Error('SEND_INTERVAL_MS harus angka nonnegatif');
const manager = new SessionManager(baileysConnector(store), store, 1000, intervalMs);
const webhook = new Webhook(process.env.WEBHOOK_URL);
const retentionDays = Number(process.env.MEDIA_RETENTION_DAYS ?? 7);
if (!Number.isFinite(retentionDays) || retentionDays <= 0) throw new Error('MEDIA_RETENTION_DAYS harus angka positif');
const baseUrl = new URL(process.env.BASE_URL ?? `http://127.0.0.1:${port}`);
if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) throw new Error('BASE_URL harus origin HTTP/HTTPS tanpa path, kredensial, atau query');
const media = new MediaStore(resolve(process.env.MEDIA_DIR ?? 'data/media'), baseUrl.origin, 32 * 1024 * 1024, retentionDays);
await media.prune();
const cleanupTimer = setInterval(() => { void media.prune().catch(() => log(undefined, `Gagal membersihkan media`)); }, 3600_000);
cleanupTimer.unref();
manager.onEvent = event => webhook.post(event);
manager.onIncoming = async (session, incoming) => {
  const { download: _download, mimetype: _mimetype, ...message } = incoming;
  await webhook.post({ event: 'message', sessionId: session.id, ...message, media: await media.save(session.id, incoming) });
};
await manager.restore();
const server = createApp(manager, apiKey, media).listen(port, process.env.HOST ?? '127.0.0.1', () => {
  log(undefined, `Engine mendengarkan port ${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    webhook.stop();
    clearInterval(cleanupTimer);
    void manager.stop().then(() => process.exit(0));
  });
}
