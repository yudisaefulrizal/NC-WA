// Optional network smoke check: obtains a QR without pairing a real account.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { SessionStore } from '../dist/store.js';
import { SessionManager } from '../dist/sessions.js';
import { baileysConnector } from '../dist/baileys.js';

const directory = await mkdtemp(join(tmpdir(), 'nc-wa-qr-'));
const store = new SessionStore(directory);
const manager = new SessionManager(baileysConnector(store), store);
try {
  await manager.create('smoke');
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    const result = manager.qr('smoke');
    if (result.status === 'qr_required' && result.qr?.startsWith('data:image/png;base64,')) {
      ready = true;
      break;
    }
    await setTimeout(250);
  }
  if (!ready) throw new Error('QR belum diperoleh dalam 30 detik');
  console.log('PASS: QR PNG diterima dari koneksi WhatsApp nyata (tanpa scan).');
} finally {
  await manager.stop();
  await rm(directory, { recursive: true, force: true });
}
