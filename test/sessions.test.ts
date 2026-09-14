import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/sessions.js';

function authorized(app: ReturnType<typeof createApp>) {
  const client = request(app);
  return {
    get: (path: string) => client.get(path).set('X-API-Key', 'test-key'),
    post: (path: string) => client.post(path).set('X-API-Key', 'test-key'),
    delete: (path: string) => client.delete(path).set('X-API-Key', 'test-key'),
  };
}
function fixture() {
  const manager = new SessionManager(async () => ({ close() {}, async logout() {} }));
  return { manager, app: createApp(manager, 'test-key') };
}
test('ID ganda ditolak 409, termasuk request bersamaan', async () => {
  const { app } = fixture();
  const results = await Promise.all([authorized(app).post('/sessions').send({ id: 'toko-a' }), authorized(app).post('/sessions').send({ id: 'toko-a' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(results.find(r => r.status === 409)?.body.error, 'session_exists');
});
test('detail session tidak ada menghasilkan 404', async () => {
  const { app } = fixture();
  const result = await authorized(app).get('/sessions/tidak-ada');
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'session_not_found');
});
test('ID yang dapat keluar dari folder auth ditolak', async () => {
  const { app } = fixture();
  for (const id of ['../secret', '', '.', 'a/b', null, 123]) {
    assert.equal((await authorized(app).post('/sessions').send({ id })).status, 400);
  }
});
test('list dan detail tidak membocorkan QR atau koneksi', async () => {
  const { app } = fixture();
  await authorized(app).post('/sessions').send({ id: 'a' });
  assert.deepEqual((await authorized(app).get('/sessions')).body, [{ id: 'a', status: 'connecting', phone: null }]);
  assert.deepEqual((await authorized(app).get('/sessions/a')).body, { id: 'a', status: 'connecting', phone: null, filter: 'all' });
});
test('logout menutup koneksi dan hapus membebaskan ID', async () => {
  const actions: string[] = [];
  const manager = new SessionManager(async (_id, update) => {
    update({ status: 'connected', phone: '628123' });
    return { close() { actions.push('close'); }, async logout() { actions.push('logout'); } };
  });
  const app = createApp(manager, 'test-key');
  await authorized(app).post('/sessions').send({ id: 'a' });
  assert.deepEqual((await authorized(app).post('/sessions/a/logout')).body, { id: 'a', status: 'logged_out' });
  assert.deepEqual(manager.qr('a'), { status: 'logged_out', qr: null });
  assert.deepEqual(actions, ['logout', 'close']);
  assert.deepEqual((await authorized(app).delete('/sessions/a')).body, { deleted: true });
  assert.equal((await authorized(app).get('/sessions/a')).status, 404);
  assert.equal((await authorized(app).post('/sessions').send({ id: 'a' })).status, 200);
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

test('seluruh API menolak key kosong/salah sebelum memproses body', async () => {
  const { app } = fixture();
  for (const key of ['', 'wrong-key', 'test-ke']) {
    const result = await request(app).post('/sessions').set('X-API-Key', key).set('Content-Type', 'application/json').send('broken-json');
    assert.equal(result.status, 401);
    assert.equal(result.body.error, 'unauthorized');
  }
  assert.equal((await request(app).get('/sessions/a/qr')).status, 401);
  assert.equal((await request(app).delete('/sessions/a')).status, 401);
  assert.equal((await request(app).post('/sessions/a/logout')).status, 401);
  assert.equal((await request(app).get('/media/secret')).status, 401);
  assert.equal((await request(app).get('/')).status, 200);
});
test('key tidak boleh kosong dan file privat tidak disajikan', async () => {
  const { manager, app } = fixture();
  assert.throws(() => createApp(manager, ''), /API_KEY/);
  for (const path of ['/.env', '/auth/a/auth/creds.json', '/SPEC.md']) {
    assert.notEqual((await authorized(app).get(path)).status, 200);
  }
});
