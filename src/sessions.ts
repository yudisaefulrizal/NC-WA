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
}
export interface Update { status?: Status; phone?: string; qr?: string; disconnected?: number }
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
  constructor(protected connect: Connector, protected store?: SessionStore, private retryBaseMs = 1000) {}
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
      if (update.qr) session.qr = update.qr;
      if (update.status === 'connected' || update.status === 'logged_out') session.qr = null;
      void this.persist(session).catch(() => console.log(`${new Date().toISOString()} [${session.id}] Gagal menyimpan metadata`));
    });
    if (generation !== session.generation) await connection.close();
    else session.connection = connection;
  }
  private status(session: Session, status: Status, reason: string) {
    if (session.status !== status) console.log(`${new Date().toISOString()} [${session.id}] ${session.status} → ${status}: ${reason}`);
    session.status = status;
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
