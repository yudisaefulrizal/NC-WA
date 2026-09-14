import type { IncomingMessage } from './incoming.js';
import { SendQueue } from './queue.js';
import type { Outbound } from './messages.js';
import type { SessionStore } from './store.js';
export type Status = 'qr_required' | 'connecting' | 'connected' | 'logged_out';
export interface SessionInfo {
  id: string;
  status: Status;
  phone: string | null;
  filter: 'all' | 'private' | 'group';
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface Connection {
  close(): void | Promise<void>;
  logout(): Promise<void>;
  send?(jid: string, content: Outbound): Promise<string>;
  exists?(jid: string): Promise<boolean>;
}
export interface Update { incoming?: IncomingMessage; status?: Status; phone?: string; qr?: string; disconnected?: number }
export type Connector = (id: string, update: (event: Update) => void) => Promise<Connection>;
interface Session extends SessionInfo {
  qr: string | null;
  connection?: Connection;
  generation: number;
  opening?: Promise<void>;
  mutation?: Promise<unknown>;
  retry?: ReturnType<typeof setTimeout>;
  attempts?: number;
  suspended?: boolean;
}

export class SessionManager {
  protected sessions = new Map<string, Session>();
  private stopped = false;
  onEvent?: (event: { event: string; sessionId: string; [key: string]: unknown }) => Promise<void>;
  onIncoming?: (session: SessionInfo, message: IncomingMessage) => Promise<void>;
  private queues = new WeakMap<Session, SendQueue>();
  constructor(protected connect: Connector, protected store?: SessionStore, private retryBaseMs = 1000, private sendIntervalMs = 1000) {}
  async restore() {
    for (const info of await this.store?.load() ?? []) {
      const session: Session = { ...info, qr: null, generation: 0 };
      this.sessions.set(info.id, session);
      if (info.status !== 'logged_out') {
        session.status = 'connecting';
        await this.open(session).catch(() => this.schedule(session));
      }
    }
  }
  protected persist(session: Session) {
    return this.store?.save(this.detail(session.id)) ?? Promise.resolve();
  }

  static validateId(id: unknown): asserts id is string {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) {
      throw new ApiError(400, 'invalid_request', 'ID harus 1–64 karakter huruf, angka, garis bawah, atau tanda hubung');
    }
  }
  protected get(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new ApiError(404, 'session_not_found', `Session ${id} tidak ada`);
    return session;
  }
  detail(id: string): SessionInfo {
    const { status, phone, filter } = this.get(id);
    return { id, status, phone, filter };
  }
  qr(id: string) { const { status, qr } = this.get(id); return { status, qr }; }
  list() { return [...this.sessions.keys()].map(id => this.detail(id)); }
  async create(id: unknown) {
    SessionManager.validateId(id);
    if (this.stopped) throw new ApiError(503, 'unavailable', 'Engine sedang berhenti');
    if (this.sessions.has(id)) throw new ApiError(409, 'session_exists', `Session ${id} sudah ada`);
    const session: Session = { id, status: 'connecting', phone: null, filter: 'all', qr: null, generation: 0 };
    this.sessions.set(id, session);
    const initialize = async () => {
      await this.persist(session);
      if (!session.suspended && !this.stopped) await this.openConnection(session).catch(() => this.schedule(session));
    };
    session.opening = initialize();
    try { await session.opening; }
    catch (error) { this.sessions.delete(id); throw error; }
    return this.detail(id);
  }
  async setFilter(id: string, filter: unknown) {
    if (filter !== 'all' && filter !== 'private' && filter !== 'group') throw new ApiError(400, 'invalid_request', 'filter harus all, private, atau group');
    return this.mutate(id, async session => {
      const previous = session.filter;
      session.filter = filter;
      try { await this.persist(session); } catch (error) { session.filter = previous; throw error; }
      return { id, filter };
    });
  }
  connected(id: string) {
    const session = this.get(id);
    if (this.stopped || session.suspended || session.status !== 'connected' || !session.connection) {
      throw new ApiError(409, 'session_not_connected', `Session ${id} belum tersambung`);
    }
    return session.connection;
  }
  async send(id: string, jid: string, content: Outbound) {
    this.connected(id);
    const session = this.get(id);
    let queue = this.queues.get(session);
    if (!queue) { queue = new SendQueue(this.sendIntervalMs); this.queues.set(session, queue); }
    return queue.run(() => {
      if (this.sessions.get(id) !== session) throw new ApiError(409, 'session_not_connected', 'Session sudah diganti');
      return this.sendNow(id, jid, content);
    });
  }
  private async sendNow(id: string, jid: string, content: Outbound) {
    const connection = this.connected(id);
    try {
      if (!jid.endsWith('@g.us') && connection.exists && !await connection.exists(jid)) throw new ApiError(400, 'invalid_number', 'Nomor tidak terdaftar di WhatsApp');
      if (!connection.send) throw new Error('Transport tidak mendukung pengiriman');
      const messageId = await connection.send(jid, content);
      return { messageId, to: jid };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, 'send_failed', 'Gagal mengirim ke WhatsApp');
    }
  }
  private async mutate<T>(id: string, action: (session: Session) => Promise<T>): Promise<T> {
    const session = this.get(id);
    const task = (session.mutation ?? Promise.resolve()).catch(() => {}).then(() => {
      if (this.sessions.get(id) !== session) throw new ApiError(404, 'session_not_found', `Session ${id} tidak ada`);
      return action(session);
    });
    session.mutation = task;
    return task;
  }
  async logout(id: string) {
    return this.mutate(id, async session => {
      session.suspended = true;
      clearTimeout(session.retry);
      await session.opening?.catch(() => {});
      if (session.status !== 'logged_out') {
        // Let WhatsApp confirm the unlink before discarding the working connection.
        try {
          if (!session.connection) throw new Error('Tidak ada koneksi');
          await session.connection.logout();
        }
        catch {
          session.suspended = false;
          if (session.status === 'connecting') this.schedule(session);
          throw new ApiError(502, 'logout_failed', 'Logout gagal; coba lagi setelah koneksi pulih');
        }
        this.queues.get(session)?.close();
        session.generation++;
        await session.connection?.close();
        session.connection = undefined;
        this.status(session, 'logged_out', 'logout API');
        session.phone = null;
        session.qr = null;
        await this.persist(session);
      }
      return { id, status: session.status };
    });
  }
  async remove(id: string) {
    return this.mutate(id, async session => {
      session.suspended = true;
      clearTimeout(session.retry);
      this.queues.get(session)?.close();
      session.generation++;
      await session.opening?.catch(() => {});
      await session.connection?.close();
      await this.store?.remove(id);
      this.sessions.delete(id);
      return { deleted: true };
    });
  }
  protected open(session: Session) {
    const opening = this.openConnection(session);
    session.opening = opening;
    return opening;
  }
  private async openConnection(session: Session) {
    const generation = ++session.generation;
    const connection = await this.connect(session.id, update => {
      if (this.sessions.get(session.id) !== session || generation !== session.generation) return;
      if (update.incoming) {
        if ((session.filter === 'private' && update.incoming.isGroup) || (session.filter === 'group' && !update.incoming.isGroup)) return;
        void this.onIncoming?.(this.detail(session.id), update.incoming).catch(() => console.log(`${new Date().toISOString()} [${session.id}] Gagal memproses pesan masuk`));
        return;
      }
      if (update.disconnected !== undefined) {
        session.generation++;
        session.qr = null;
        if (update.disconnected === 401) {
          this.status(session, 'logged_out', 'device dihapus');
          session.phone = null;
        } else {
          this.status(session, 'connecting', `koneksi putus ${update.disconnected}`);
          this.schedule(session, update.disconnected === 515);
        }
      }
      if (update.status) this.status(session, update.status, 'update koneksi');
      if (update.status === 'connected') session.attempts = 0;
      if (update.phone) session.phone = update.phone;
      if (update.qr) { session.qr = update.qr; this.emit({ event: 'session.qr', sessionId: session.id, qr: update.qr }); }
      if (update.status === 'connected' || update.status === 'logged_out') session.qr = null;
      void this.persist(session).catch(() => console.log(`${new Date().toISOString()} [${session.id}] Gagal menyimpan metadata`));
    });
    if (generation !== session.generation) await connection.close();
    else session.connection = connection;
  }
  private status(session: Session, status: Status, reason: string) {
    if (session.status !== status) console.log(`${new Date().toISOString()} [${session.id}] ${session.status} → ${status}: ${reason}`);
    const changed = session.status !== status;
    session.status = status;
    if (changed) queueMicrotask(() => this.emit({ event: 'session.status', sessionId: session.id, status, phone: session.phone }));
  }
  private emit(event: { event: string; sessionId: string; [key: string]: unknown }) {
    void this.onEvent?.(event).catch(() => console.log(`${new Date().toISOString()} [${event.sessionId}] Webhook gagal`));
  }
  private schedule(session: Session, immediate = false) {
    if (this.stopped || session.suspended || session.status === 'logged_out' || this.sessions.get(session.id) !== session) return;
    clearTimeout(session.retry);
    const attempt = session.attempts = (session.attempts ?? 0) + 1;
    const delay = immediate ? 0 : Math.min(this.retryBaseMs * 2 ** Math.min(attempt - 1, 6), 30_000);
    console.log(`${new Date().toISOString()} [${session.id}] Reconnect percobaan ${attempt}, jeda ${delay}ms`);
    session.retry = setTimeout(() => {
      void (async () => {
        await session.opening?.catch(() => {});
        if (this.stopped || session.suspended || this.sessions.get(session.id) !== session || session.status === 'logged_out') return;
        await session.connection?.close();
        session.connection = undefined;
        if (this.stopped || session.suspended) return;
        await this.open(session);
      })().catch(() => {
        console.log(`${new Date().toISOString()} [${session.id}] Reconnect gagal`);
        this.schedule(session);
      });
    }, delay);
    session.retry.unref();
  }
  async stop() {
    this.stopped = true;
    for (const session of this.sessions.values()) {
      session.suspended = true;
      clearTimeout(session.retry);
      this.queues.get(session)?.close();
      session.generation++;
    }
    for (const session of this.sessions.values()) {
      await session.opening?.catch(() => {});
      await session.mutation?.catch(() => {});
      await session.connection?.close();
    }
    await this.store?.flush();
  }
}
