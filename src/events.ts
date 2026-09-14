import type { Request, Response } from 'express';

type Payload = { event: string; sessionId: string; [key: string]: unknown };

// Menyiarkan event ke halaman yang sedang terbuka. Tidak menyimpan apa pun:
// event yang lewat tanpa pendengar hilang begitu saja.
export class EventStream {
  private clients = new Set<Response>();
  private heartbeat?: ReturnType<typeof setInterval>;

  handler = (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': terhubung\n\n');
    this.clients.add(res);
    // Proxy dan jaringan memutus koneksi yang diam; komentar berkala menahannya.
    this.heartbeat ??= setInterval(() => {
      for (const client of this.clients) client.write(': ping\n\n');
    }, 25_000).unref();
    req.on('close', () => {
      this.clients.delete(res);
      if (!this.clients.size) { clearInterval(this.heartbeat); this.heartbeat = undefined; }
    });
  };

  push(payload: Payload) {
    if (!this.clients.size) return;
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) client.write(frame);
  }

  stop() {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const client of this.clients) client.end();
    this.clients.clear();
  }
}
