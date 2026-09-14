import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager, type Update } from '../src/sessions.js';
import { SendQueue } from '../src/queue.js';

test('kirim tanpa tujuan 400; session belum connected 409', async () => {
  const manager = new SessionManager(async () => ({ close() {}, async logout() {} }));
  await manager.create('a');
  const app = createApp(manager, 'key');
  const send = (body: object) => request(app).post('/sessions/a/messages/text').set('X-API-Key', 'key').send(body);
  assert.equal((await send({ text: 'halo' })).status, 400);
  const result = await send({ to: '62812345678', text: 'halo' });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'session_not_connected');
});
test('kirim teks dan media mengembalikan ID; grup tidak dicek sebagai nomor', async () => {
  const destinations: string[] = [];
  const checked: string[] = [];
  const manager = new SessionManager(async (_id, update) => {
    update({ status: 'connected' });
    return { close() {}, async logout() {}, async exists(jid) { checked.push(jid); return true; }, async send(jid) { destinations.push(jid); return 'msg'; } };
  }, undefined, 5, 0);
  await manager.create('a');
  const app = createApp(manager, 'key');
  const text = await request(app).post('/sessions/a/messages/text').set('X-API-Key', 'key').send({ to: '62812345678', text: 'halo' });
  assert.deepEqual(text.body, { messageId: 'msg', to: '62812345678@s.whatsapp.net' });
  await manager.send('a', '123-456@g.us', { type: 'image', url: 'https://example.com/image.png', caption: 'hi' });
  assert.deepEqual(destinations, ['62812345678@s.whatsapp.net', '123-456@g.us']);
  assert.deepEqual(checked, ['62812345678@s.whatsapp.net']);
});
test('queue memberi jeda setelah selesai, tetap berjalan setelah kegagalan', async () => {
  const times: number[] = [];
  const queue = new SendQueue(25);
  const work = (fail = false) => queue.run(async () => { times.push(Date.now()); if (fail) throw new Error('failed'); });
  const result = await Promise.allSettled([work(true), work(), work()]);
  assert.equal(result[0].status, 'rejected');
  assert.equal(result[2].status, 'fulfilled');
  assert.ok(times[1] - times[0] >= 24);
  assert.ok(times[2] - times[1] >= 24);
});
test('pesan dalam antrean dibatalkan jika session dihapus', async () => {
  let sends = 0;
  const manager = new SessionManager(async (_id, update) => {
    update({ status: 'connected' });
    return { close() {}, async logout() {}, async send() { sends++; return 'id'; } };
  }, undefined, 5, 100);
  await manager.create('a');
  await manager.send('a', '123@g.us', { text: 'one' });
  const pending = manager.send('a', '123@g.us', { text: 'two' });
  const rejected = assert.rejects(pending, { code: 'session_not_connected' });
  await manager.remove('a');
  await rejected;
  assert.equal(sends, 1);
});
