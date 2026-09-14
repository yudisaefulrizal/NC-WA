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
