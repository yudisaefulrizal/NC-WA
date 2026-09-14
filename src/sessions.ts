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
}

export class SessionManager {
  protected sessions = new Map<string, Session>();
  constructor(protected connect: Connector, protected store?: SessionStore) {}
  async restore() {
    for (const info of await this.store?.load() ?? []) {
      const session: Session = { ...info, qr: null, generation: 0 };
      this.sessions.set(info.id, session);
      if (info.status !== 'logged_out') {
        session.status = 'connecting';
        await this.open(session);
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
    if (this.sessions.has(id)) throw new ApiError(409, 'session_exists', `Session ${id} sudah ada`);
    const session: Session = { id, status: 'connecting', phone: null, filter: 'all', qr: null, generation: 0 };
    this.sessions.set(id, session);
    try { await this.persist(session); await this.open(session); }
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
      await session.opening;
      if (session.status !== 'logged_out') {
        // Let WhatsApp confirm the unlink before discarding the working connection.
        try { await session.connection?.logout(); }
        catch { throw new ApiError(502, 'logout_failed', 'Logout gagal; coba lagi setelah koneksi pulih'); }
        session.generation++;
        await session.connection?.close();
        session.connection = undefined;
        session.status = 'logged_out';
        session.phone = null;
        session.qr = null;
        await this.persist(session);
      }
      return { id, status: session.status };
    });
  }
  async remove(id: string) {
    return this.mutate(id, async session => {
      session.generation++;
      await session.opening;
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
      if (update.status) session.status = update.status;
      if (update.phone) session.phone = update.phone;
      if (update.qr) session.qr = update.qr;
      if (update.status === 'connected' || update.status === 'logged_out') session.qr = null;
      void this.persist(session).catch(() => console.log(`${new Date().toISOString()} [${session.id}] Gagal menyimpan metadata`));
    });
    if (generation !== session.generation) await connection.close();
    else session.connection = connection;
  }
  async stop() {
    for (const session of this.sessions.values()) {
      session.generation++;
      await session.opening;
      await session.mutation?.catch(() => {});
      await session.connection?.close();
    }
    await this.store?.flush();
  }
}
