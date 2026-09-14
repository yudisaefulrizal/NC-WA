import { resolve } from 'node:path';
import { createApp } from './app.js';
import { baileysConnector } from './baileys.js';
import { SessionManager } from './sessions.js';
import { SessionStore } from './store.js';

const port = Number(process.env.PORT ?? 8066);
const store = new SessionStore(resolve(process.env.AUTH_DIR ?? 'auth'));
const manager = new SessionManager(baileysConnector(store), store);
await manager.restore();
const server = createApp(manager).listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`${new Date().toISOString()} Engine mendengarkan port ${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void manager.stop().then(() => process.exit(0));
  });
}
