import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import { MediaStore } from '../src/media.js';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/sessions.js';

test('media per session tidak bertabrakan, unduhan butuh key, retensi menghapus file lama', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nc-wa-media-'));
  try {
    const store = new MediaStore(root, 'https://gateway.test', 100, 1);
    const message = { messageId: 'same-id', from: '123', sender: '123', isGroup: false, groupId: null, type: 'image' as const, text: '', timestamp: 1, mimetype: 'image/png', download: async () => Readable.from(['fake-image']) };
    const a = await store.save('a', message);
    const b = await store.save('b', message);
    assert.notEqual(a?.url, b?.url);
    const path = new URL(a!.url).pathname;
    const app = createApp(new SessionManager(async () => ({ close() {}, async logout() {} })), 'key', store);
    assert.equal((await request(app).get(path)).status, 401);
    const result = await request(app).get(path).set('X-API-Key', 'key');
    assert.equal(result.status, 200);
    assert.equal(result.headers['content-type'], 'image/png');
    const file = await store.get(path.split('/').at(-1)!);
    const old = new Date(Date.now() - 2 * 86400_000);
    await utimes(file.path, old, old);
    await utimes(`${file.path}.json`, old, old);
    assert.equal((await request(app).get(path).set('X-API-Key', 'key')).status, 404);
    await store.prune();
    await assert.rejects(stat(file.path), { code: 'ENOENT' });
    await assert.rejects(stat(`${file.path}.json`), { code: 'ENOENT' });
    assert.ok(await store.get(new URL(b!.url).pathname.split('/').at(-1)!));
  } finally { await rm(root, { recursive: true, force: true }); }
});
