import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager, type Update } from '../src/sessions.js';
test('stats menghitung status dan pesan sejak engine mulai', async () => {
  let update!: (event: Update) => void;
  const manager = new SessionManager(async (_id, cb) => {
    update = cb; cb({ status: 'connected' });
    return { close() {}, async logout() {}, async send() { return 'id'; } };
  });
  await manager.create('a');
  await manager.send('a', '123@g.us', { text: 'hi' });
  update({ incoming: { messageId: 'in', from: '123', sender: '123', isGroup: false, groupId: null, type: 'text', text: 'hi', timestamp: 1 } });
  const response = await request(createApp(manager, 'key')).get('/stats').set('X-API-Key', 'key');
  assert.equal(response.status, 200);
  assert.equal(response.body.sessions.total, 1);
  assert.equal(response.body.sessions.connected, 1);
  assert.equal(typeof response.body.uptime, 'number');
  assert.deepEqual(response.body.messages, { sent: 1, received: 1 });
});
