import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/sessions.js';
test('body JSON yang melebihi 64 KiB ditolak 413', async () => {
  const manager = new SessionManager(async () => ({ close() {}, async logout() {} }));
  const app = createApp(manager, 'key');
  const response = await request(app).post('/sessions').set('X-API-Key', 'key').send({ id: 'a', extra: 'x'.repeat(65536) });
  assert.equal(response.status, 413);
  assert.equal(response.body.error, 'invalid_request');
  assert.deepEqual(manager.list(), []);
});
