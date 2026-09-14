import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { join } from 'node:path';
import type { Connector } from './sessions.js';
import type { SessionStore } from './store.js';

// Baileys requires this interface. Suppress library traffic and credential logs.
const silentLogger = {
  level: 'silent', child() { return silentLogger; },
  trace() {}, debug() {}, info() {}, warn() {}, error() {},
};
export function baileysConnector(store: SessionStore): Connector {
  return async (id, update) => {
    const { state, saveCreds } = await useMultiFileAuthState(join(store.directory(id), 'auth'));
    const socket = makeWASocket({ auth: state, logger: silentLogger, markOnlineOnConnect: false, syncFullHistory: false });
    let saves = Promise.resolve();
    socket.ev.on('creds.update', () => {
      saves = saves.then(saveCreds).catch(() => {
        console.log(`${new Date().toISOString()} [${id}] Gagal menyimpan kredensial`);
      });
    });
    let qrGeneration = 0;
    socket.ev.on('connection.update', event => {
      if (event.connection === 'open' || event.connection === 'close') qrGeneration++;
      if (event.qr) {
        const generation = ++qrGeneration;
        void QRCode.toDataURL(event.qr).then(qr => {
          if (generation === qrGeneration) update({ status: 'qr_required', qr });
        }).catch(() => console.log(`${new Date().toISOString()} [${id}] Gagal membuat QR`));
      }
      if (event.connection === 'open') update({ status: 'connected', phone: socket.user?.id.split(':')[0].split('@')[0] });
      if (event.connection === 'close') {
        const error = event.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        update({ disconnected: error?.output?.statusCode ?? 0 });
      }
    });
    return {
      async exists(jid) { return Boolean((await socket.onWhatsApp(jid))?.some(result => result.exists)); },
      async send(jid, content) {
        const message = await socket.sendMessage(jid, content);
        if (!message?.key.id) throw new Error('WhatsApp tidak memberikan ID pesan');
        return message.key.id;
      },
      async close() { qrGeneration++; socket.ev.removeAllListeners('connection.update'); socket.end(undefined); await saves; },
      async logout() { await socket.logout(); await saves; },
    };
  };
}
