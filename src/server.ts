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
const manager = new SessionManager(baileysConnector(store), store);
const webhook = new Webhook(process.env.WEBHOOK_URL);
const media = new MediaStore(resolve(process.env.MEDIA_DIR ?? 'data/media'), process.env.BASE_URL ?? `http://127.0.0.1:${port}`);
manager.onEvent = event => webhook.post(event);
manager.onIncoming = async (session, incoming) => {
  const { download: _download, mimetype: _mimetype, ...message } = incoming;
  await webhook.post({ event: 'message', sessionId: session.id, ...message, media: await media.save(session.id, incoming) });
};
await manager.restore();
const server = createApp(manager, apiKey, media).listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`${new Date().toISOString()} Engine mendengarkan port ${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    webhook.stop();
    void manager.stop().then(() => process.exit(0));
  });
}
