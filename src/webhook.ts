import { setTimeout } from 'node:timers/promises';
export class Webhook {
  private abort = new AbortController();
  constructor(private url = '', private send: typeof fetch = fetch, private retryMs = 1000) {
    if (url && !['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('WEBHOOK_URL harus HTTP atau HTTPS');
  }
  async post(payload: { event: string; sessionId: string; [key: string]: unknown }) {
    if (!this.url) return;
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (this.abort.signal.aborted) return;
      try {
        const response = await this.send(this.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), redirect: 'error',
          signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10_000)]),
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error('Webhook gagal');
        return;
      } catch {
        if (this.abort.signal.aborted) return;
        console.log(`${new Date().toISOString()} [${payload.sessionId}] Webhook gagal, percobaan ${attempt + 1}/4`);
        if (attempt === 3) return;
        await setTimeout(this.retryMs * 2 ** attempt, undefined, { signal: this.abort.signal }).catch(() => {});
      }
    }
  }
  stop() { this.abort.abort(); }
}
