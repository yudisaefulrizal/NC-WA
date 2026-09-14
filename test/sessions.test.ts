import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/sessions.js';

function fixture() {
  const manager = new SessionManager(async () => ({ close() {}, async logout() {} }));
  return { manager, app: createApp(manager) };
}
test('ID ganda ditolak 409, termasuk request bersamaan', async () => {
  const { app } = fixture();
  const results = await Promise.all([request(app).post('/sessions').send({ id: 'toko-a' }), request(app).post('/sessions').send({ id: 'toko-a' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(results.find(r => r.status === 409)?.body.error, 'session_exists');
});
test('detail session tidak ada menghasilkan 404', async () => {
  const { app } = fixture();
  const result = await request(app).get('/sessions/tidak-ada');
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'session_not_found');
});
test('ID yang dapat keluar dari folder auth ditolak', async () => {
  const { app } = fixture();
  for (const id of ['../secret', '', '.', 'a/b', null, 123]) {
    assert.equal((await request(app).post('/sessions').send({ id })).status, 400);
  }
});
test('list dan detail tidak membocorkan QR atau koneksi', async () => {
  const { app } = fixture();
  await request(app).post('/sessions').send({ id: 'a' });
  assert.deepEqual((await request(app).get('/sessions')).body, [{ id: 'a', status: 'connecting', phone: null }]);
  assert.deepEqual((await request(app).get('/sessions/a')).body, { id: 'a', status: 'connecting', phone: null, filter: 'all' });
});
test('logout menutup koneksi dan hapus membebaskan ID', async () => {
  const actions: string[] = [];
  const manager = new SessionManager(async (_id, update) => {
    update({ status: 'connected', phone: '628123' });
    return { close() { actions.push('close'); }, async logout() { actions.push('logout'); } };
  });
  const app = createApp(manager);
  await request(app).post('/sessions').send({ id: 'a' });
  assert.deepEqual((await request(app).post('/sessions/a/logout')).body, { id: 'a', status: 'logged_out' });
  assert.deepEqual(manager.qr('a'), { status: 'logged_out', qr: null });
  assert.deepEqual(actions, ['logout', 'close']);
  assert.deepEqual((await request(app).delete('/sessions/a')).body, { deleted: true });
  assert.equal((await request(app).get('/sessions/a')).status, 404);
  assert.equal((await request(app).post('/sessions').send({ id: 'a' })).status, 200);
});

test('putus biasa reconnect; event socket lama dan loggedOut tidak reconnect', async () => {
  const updates: Array<(event: import('../src/sessions.js').Update) => void> = [];
  const manager = new SessionManager(async (_id, update) => {
    updates.push(update);
    return { close() {}, async logout() {} };
  }, undefined, 5);
  await manager.create('a');
  updates[0]({ status: 'qr_required', qr: 'qr-lama' });
  updates[0]({ disconnected: 408 });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(updates.length, 2);
  updates[1]({ status: 'connected', phone: '628123' });
  updates[0]({ status: 'qr_required', qr: 'stale' });
  assert.deepEqual(manager.qr('a'), { status: 'connected', qr: null });
  updates[1]({ disconnected: 401 });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(updates.length, 2);
  assert.equal(manager.detail('a').status, 'logged_out');
  await manager.stop();
});
test('hapus dan shutdown membatalkan reconnect tertunda', async () => {
  for (const action of ['remove', 'stop']) {
    let count = 0;
    let update!: (event: import('../src/sessions.js').Update) => void;
    const manager = new SessionManager(async (_id, callback) => {
      count++; update = callback;
      return { close() {}, async logout() {} };
    }, undefined, 10);
    await manager.create('a');
    update({ disconnected: 408 });
    if (action === 'remove') await manager.remove('a'); else await manager.stop();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(count, 1);
  }
});
