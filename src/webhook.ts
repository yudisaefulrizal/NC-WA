export class Webhook {
  constructor(private url = '', private send: typeof fetch = fetch) {
    if (url && !['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('WEBHOOK_URL harus HTTP atau HTTPS');
  }
  async post(payload: { event: string; sessionId: string; [key: string]: unknown }) {
    if (!this.url) return;
    const response = await this.send(this.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('Webhook gagal');
  }
}
