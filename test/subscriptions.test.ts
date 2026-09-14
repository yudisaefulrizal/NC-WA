import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_SUBSCRIPTIONS, Subscriptions } from '../src/subscriptions.js';
import { Webhook, type Payload } from '../src/webhook.js';

async function store() {
  const directory = await mkdtemp(join(tmpdir(), 'nc-wa-webhooks-'));
  const file = join(directory, 'webhooks.json');
  const subscriptions = new Subscriptions(file);
  await subscriptions.load();
  return { subscriptions, file };
}

// URL publik palsu: validatePublicUrl menolak alamat lokal, jadi tes memakai
// host yang resolve ke alamat publik lewat DNS asli.
const URL_A = 'https://example.com/hook-a';
const URL_B = 'https://example.com/hook-b';

test('mendaftar webhook mengembalikan id dan menyimpannya', async () => {
  const { subscriptions, file } = await store();
  const created = await subscriptions.add({ url: URL_A });
  assert.match(created.id, /^wh_[0-9a-f]{12}$/);
  assert.equal(created.url, URL_A);
  assert.equal(created.sessionId, null);
  assert.deepEqual(subscriptions.list(), [created]);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), [created]);
});

test('mendaftar URL yang sama dua kali tidak membuat duplikat', async () => {
  const { subscriptions } = await store();
  const first = await subscriptions.add({ url: URL_A });
  const second = await subscriptions.add({ url: URL_A });
  assert.equal(second.id, first.id);
  assert.equal(subscriptions.list().length, 1);
});

test('URL sama dengan session berbeda tetap langganan terpisah', async () => {
  const { subscriptions } = await store();
  const semua = await subscriptions.add({ url: URL_A });
  const satu = await subscriptions.add({ url: URL_A, sessionId: 'toko-a' });
  assert.notEqual(satu.id, semua.id);
  assert.equal(subscriptions.list().length, 2);
});

test('URL ke alamat lokal ditolak', async () => {
  const { subscriptions } = await store();
  for (const url of ['http://127.0.0.1/hook', 'http://localhost:8066/hook', 'http://[::1]/hook']) {
    await assert.rejects(subscriptions.add({ url }), /alamat HTTP\/HTTPS publik/);
  }
  assert.equal(subscriptions.list().length, 0);
});

test('URL bukan http atau https ditolak', async () => {
  const { subscriptions } = await store();
  for (const url of ['ftp://example.com/hook', 'file:///etc/passwd', 'bukan-url']) {
    await assert.rejects(subscriptions.add({ url }));
  }
});

test('url wajib diisi', async () => {
  const { subscriptions } = await store();
  await assert.rejects(subscriptions.add({}), /url wajib diisi/);
  await assert.rejects(subscriptions.add({ url: '   ' }), /url wajib diisi/);
});

test('langganan melebihi batas ditolak', async () => {
  const { subscriptions } = await store();
  for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) {
    await subscriptions.add({ url: `https://example.com/hook-${i}` });
  }
  await assert.rejects(
    subscriptions.add({ url: 'https://example.com/kelebihan' }),
    (error: { code?: string }) => (error as { code: string }).code === 'too_many_webhooks',
  );
  assert.equal(subscriptions.list().length, MAX_SUBSCRIPTIONS);
});

test('mencabut langganan menghapusnya dari daftar dan disk', async () => {
  const { subscriptions, file } = await store();
  const created = await subscriptions.add({ url: URL_A });
  assert.deepEqual(await subscriptions.remove(created.id), { deleted: true });
  assert.deepEqual(subscriptions.list(), []);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), []);
  await assert.rejects(subscriptions.remove(created.id), /tidak terdaftar/);
});

test('langganan bertahan setelah dimuat ulang', async () => {
  const { subscriptions, file } = await store();
  const created = await subscriptions.add({ url: URL_A, sessionId: 'toko-a' });
  await subscriptions.flush();

  const lagi = new Subscriptions(file);
  await lagi.load();
  assert.deepEqual(lagi.list(), [created]);
});

test('berkas rusak ditolak, bukan diam-diam dianggap kosong', async () => {
  const { file } = await store();
  await writeFile(file, '{bukan json}');
  await assert.rejects(new Subscriptions(file).load(), /tidak valid/);
});

test('targets menyaring berdasarkan session', async () => {
  const { subscriptions } = await store();
  await subscriptions.add({ url: URL_A });
  await subscriptions.add({ url: URL_B, sessionId: 'toko-a' });

  assert.deepEqual(subscriptions.targets('toko-a').sort(), [URL_A, URL_B].sort());
  assert.deepEqual(subscriptions.targets('toko-b'), [URL_A]);
});

test('webhook mengirim ke env dan langganan sekaligus', async () => {
  const { subscriptions } = await store();
  await subscriptions.add({ url: URL_A });

  const dikirim: string[] = [];
  const webhook = new Webhook('https://example.com/env-hook', async (target: string | URL | Request) => {
    dikirim.push(String(target));
    return new Response('', { status: 200 });
  }, 1, payload => subscriptions.targets(payload.sessionId));

  await webhook.post({ event: 'message', sessionId: 'toko-a' } as Payload);
  assert.deepEqual(dikirim.sort(), ['https://example.com/env-hook', URL_A].sort());
});

test('satu langganan gagal tidak menghentikan yang lain', async () => {
  const { subscriptions } = await store();
  await subscriptions.add({ url: URL_A });
  await subscriptions.add({ url: URL_B });

  const berhasil: string[] = [];
  const webhook = new Webhook('', async (target: string | URL | Request) => {
    if (String(target) === URL_A) throw new Error('jaringan mati');
    berhasil.push(String(target));
    return new Response('', { status: 200 });
  }, 1, payload => subscriptions.targets(payload.sessionId));

  await webhook.post({ event: 'message', sessionId: 'toko-a' } as Payload);
  assert.deepEqual(berhasil, [URL_B]);
});

test('tanpa env dan tanpa langganan, tidak ada kiriman', async () => {
  const { subscriptions } = await store();
  let dipanggil = 0;
  const webhook = new Webhook('', async () => { dipanggil++; return new Response('', { status: 200 }); },
    1, payload => subscriptions.targets(payload.sessionId));
  await webhook.post({ event: 'message', sessionId: 'toko-a' } as Payload);
  assert.equal(dipanggil, 0);
});
