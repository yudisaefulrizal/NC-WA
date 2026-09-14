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

import { isPublicAddress, validatePublicUrl, downloadPublicMedia } from '../src/download.js';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
test('URL media menolak localhost, private IPv4/IPv6, format alternatif, dan protokol lain', async () => {
  for (const url of ['http://127.0.0.1/a', 'http://2130706433/', 'http://0x7f000001/', 'http://10.0.0.1/', 'http://169.254.169.254/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fd00::1]/', 'file:///etc/passwd', 'http://user:pass@example.com/']) {
    await assert.rejects(validatePublicUrl(url), { code: 'invalid_request' });
  }
  await assert.rejects(validatePublicUrl('https://example.com', async () => [{ address: '127.0.0.1', family: 4 }]), { code: 'invalid_request' });
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('100.64.0.1'), false);
});
function response(statusCode: number, headers: object, data = ''): IncomingMessage {
  return Object.assign(Readable.from([data]), { statusCode, headers }) as unknown as IncomingMessage;
}
test('redirect ke alamat internal ditolak sebelum request kedua', async () => {
  let requests = 0;
  await assert.rejects(downloadPublicMedia('https://example.com', {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    open: async () => { requests++; return response(302, { location: 'http://127.0.0.1/private' }); },
  }), { code: 'invalid_request' });
  assert.equal(requests, 1);
});
test('unduh media memakai alamat tervalidasi dan membatasi stream tanpa content-length', async () => {
  const options = {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    open: async (_url: URL, addresses: Array<{address: string}>) => {
      assert.equal(addresses[0].address, '8.8.8.8');
      return response(200, { 'content-type': 'image/png' }, 'abcdef');
    },
  };
  await assert.rejects(downloadPublicMedia('https://example.com/a', { ...options, maxBytes: 3 }), { code: 'invalid_request' });
  const file = await downloadPublicMedia('https://example.com/a', options);
  try { assert.equal(await readFile(file.path, 'utf8'), 'abcdef'); } finally { await file.cleanup(); }
});
