import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { EventStream } from '../src/events.js';
import { SessionManager } from '../src/sessions.js';

function fixture() {
  const manager = new SessionManager(async () => ({ close() {}, async logout() {} }));
  const events = new EventStream();
  const app = createApp(manager, 'test-key', undefined, events);
  const server = app.listen(0);
  return { events, server };
}

async function base(server: ReturnType<typeof fixture>['server']) {
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Tidak ada port');
  return `http://127.0.0.1:${address.port}`;
}

test('aliran event menolak tanpa API key dan menerima lewat query', async () => {
  const { server, events } = fixture();
  const url = await base(server);
  try {
    assert.equal((await fetch(`${url}/events`)).status, 401);
    assert.equal((await fetch(`${url}/events?key=salah`)).status, 401);

    const response = await fetch(`${url}/events?key=test-key`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    await response.body?.cancel();
  } finally { events.stop(); server.close(); }
});

test('event yang didorong sampai ke pendengar', async () => {
  const { server, events } = fixture();
  const url = await base(server);
  try {
    const response = await fetch(`${url}/events?key=test-key`);
    const reader = response.body!.getReader();
    await reader.read(); // komentar pembuka

    events.push({ event: 'message', sessionId: 'a', text: 'halo' });
    const { value } = await reader.read();
    const frame = new TextDecoder().decode(value);
    assert.match(frame, /^data: /);
    assert.deepEqual(JSON.parse(frame.slice(6)), { event: 'message', sessionId: 'a', text: 'halo' });
    await reader.cancel();
  } finally { events.stop(); server.close(); }
});

test('push tanpa pendengar tidak menyimpan apa pun', async () => {
  const { server, events } = fixture();
  const url = await base(server);
  try {
    events.push({ event: 'message', sessionId: 'a', text: 'hilang' });

    const response = await fetch(`${url}/events?key=test-key`);
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    // Pendengar baru hanya menerima komentar pembuka, bukan event lama.
    assert.equal(new TextDecoder().decode(value), ': terhubung\n\n');
    await reader.cancel();
  } finally { events.stop(); server.close(); }
});
