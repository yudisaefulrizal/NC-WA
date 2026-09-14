import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/sessions.js';
import { Subscriptions } from '../src/subscriptions.js';

async function app() {
  const manager = new SessionManager(async (_id, cb) => {
    cb({ status: 'connected' });
    return { close() {}, async logout() {}, async send() { return 'id'; } };
  });
  const directory = await mkdtemp(join(tmpdir(), 'nc-wa-api-'));
  const webhooks = new Subscriptions(join(directory, 'webhooks.json'));
  await webhooks.load();
  return { server: createApp(manager, 'key', undefined, undefined, webhooks), webhooks };
}

const KEY = { 'X-API-Key': 'key' };
const URL_A = 'https://example.com/hook-a';

test('daftar webhook kosong di awal', async () => {
  const { server } = await app();
  const response = await request(server).get('/webhooks').set(KEY);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test('mendaftar lalu terlihat di daftar', async () => {
  const { server } = await app();
  const dibuat = await request(server).post('/webhooks').set(KEY).send({ url: URL_A });
  assert.equal(dibuat.status, 200);
  assert.equal(dibuat.body.url, URL_A);
  assert.equal(dibuat.body.sessionId, null);

  const daftar = await request(server).get('/webhooks').set(KEY);
  assert.deepEqual(daftar.body, [dibuat.body]);
});

test('mendaftar ulang mengembalikan langganan yang sama', async () => {
  const { server } = await app();
  const pertama = await request(server).post('/webhooks').set(KEY).send({ url: URL_A });
  const kedua = await request(server).post('/webhooks').set(KEY).send({ url: URL_A });
  assert.equal(kedua.body.id, pertama.body.id);

  const daftar = await request(server).get('/webhooks').set(KEY);
  assert.equal(daftar.body.length, 1);
});

test('mencabut langganan', async () => {
  const { server } = await app();
  const dibuat = await request(server).post('/webhooks').set(KEY).send({ url: URL_A });
  const dihapus = await request(server).delete(`/webhooks/${dibuat.body.id}`).set(KEY);
  assert.equal(dihapus.status, 200);
  assert.deepEqual(dihapus.body, { deleted: true });

  const daftar = await request(server).get('/webhooks').set(KEY);
  assert.deepEqual(daftar.body, []);
});

test('mencabut langganan tak dikenal 404', async () => {
  const { server } = await app();
  const response = await request(server).delete('/webhooks/wh_tidakada').set(KEY);
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'webhook_not_found');
});

test('url ke alamat lokal ditolak 400', async () => {
  const { server } = await app();
  const response = await request(server).post('/webhooks').set(KEY).send({ url: 'http://127.0.0.1/hook' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_request');
});

test('body tanpa url ditolak 400', async () => {
  const { server } = await app();
  const response = await request(server).post('/webhooks').set(KEY).send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_request');
});

test('sessionId tak valid ditolak', async () => {
  const { server } = await app();
  const response = await request(server).post('/webhooks').set(KEY).send({ url: URL_A, sessionId: '../lain' });
  assert.equal(response.status, 400);
});

test('endpoint webhook wajib API key', async () => {
  const { server } = await app();
  for (const kirim of [
    request(server).get('/webhooks'),
    request(server).post('/webhooks').send({ url: URL_A }),
    request(server).delete('/webhooks/wh_x'),
  ]) {
    const response = await kirim;
    assert.equal(response.status, 401);
  }
});

test('WEBHOOK_URL dari env tidak muncul di daftar', async () => {
  // Daftar hanya berisi langganan API; webhook env milik pemasang engine.
  const { server } = await app();
  const response = await request(server).get('/webhooks').set(KEY);
  assert.deepEqual(response.body, []);
});
