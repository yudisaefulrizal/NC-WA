import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager, type Connector, type Update } from '../src/sessions.js';
import { SessionStore } from '../src/store.js';

test('restore membuka session aktif dan mempertahankan logged_out tanpa koneksi', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nc-wa-test-'));
  const callbacks = new Map<string, (event: Update) => void>();
  const connected: string[] = [];
  const connect: Connector = async (id, update) => {
    callbacks.set(id, update);
    connected.push(id);
    return { close() {}, async logout() {} };
  };
  let manager = new SessionManager(connect, new SessionStore(root));
  try {
    await manager.create('active');
    callbacks.get('active')!({ status: 'connected', phone: '628123' });
    await manager.create('out');
    await manager.logout('out');
    await manager.stop();
    connected.length = 0;
    manager = new SessionManager(connect, new SessionStore(root));
    await manager.restore();
    assert.deepEqual(connected, ['active']);
    assert.equal(manager.detail('out').status, 'logged_out');
    assert.equal(manager.detail('active').phone, '628123');
    assert.equal(JSON.parse(await readFile(join(root, 'active', 'session.json'), 'utf8')).status, 'connected');
    await manager.remove('active');
    await assert.rejects(stat(join(root, 'active')), { code: 'ENOENT' });
  } finally { await manager.stop(); await rm(root, { recursive: true, force: true }); }
});

test('hapus menunggu koneksi yang sedang dibuka dan mengabaikan callback terlambat', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let update!: (event: Update) => void;
  let closed = 0;
  const manager = new SessionManager(async (_id, callback) => {
    update = callback;
    await pending;
    return { close() { closed++; }, async logout() {} };
  });
  const creating = manager.create('a');
  await new Promise(resolve => setImmediate(resolve));
  const deleting = manager.remove('a');
  await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.allSettled([creating, deleting]);
  update({ status: 'connected', phone: '628123' });
  assert.deepEqual(manager.list(), []);
  assert.equal(closed, 1);
});

test('kegagalan pembukaan pertama dicoba ulang dan kegagalan logout tidak menghapus state', async () => {
  let attempts = 0;
  const manager = new SessionManager(async (_id, update) => {
    if (++attempts === 1) throw new Error('network');
    update({ status: 'connected' });
    return { close() {}, async logout() { throw new Error('network'); } };
  }, undefined, 5);
  await manager.create('a');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(attempts, 2);
  await assert.rejects(manager.logout('a'), { code: 'logout_failed' });
  assert.equal(manager.detail('a').status, 'connected');
  await manager.stop();
});

test('reconnect yang gagal membuka socket tetap mencoba kembali', async () => {
  let attempts = 0;
  let update!: (event: Update) => void;
  const manager = new SessionManager(async (_id, callback) => {
    update = callback;
    if (++attempts === 2) throw new Error('network');
    callback({ status: 'connected' });
    return { close() {}, async logout() {} };
  }, undefined, 5);
  try {
    await manager.create('a');
    update({ disconnected: 408 });
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(attempts, 3);
    assert.equal(manager.detail('a').status, 'connected');
  } finally { await manager.stop(); }
});
