import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from '../src/webhook.js';
test('webhook gagal mencoba sekali + retry 3x lalu berhenti', async () => {
  let attempts = 0;
  const webhook = new Webhook('https://example.com/hook', async () => { attempts++; return new Response('', { status: 503 }); }, 1);
  await webhook.post({ event: 'message', sessionId: 'a' });
  assert.equal(attempts, 4);
});
test('webhook berhenti setelah sukses dan tidak mengirim API key', async () => {
  let attempts = 0;
  const webhook = new Webhook('https://example.com/hook', async (_url, options) => {
    attempts++;
    assert.deepEqual(options?.headers, { 'Content-Type': 'application/json' });
    return new Response('', { status: attempts === 1 ? 500 : 200 });
  }, 1);
  await webhook.post({ event: 'message', sessionId: 'a' });
  assert.equal(attempts, 2);
});
