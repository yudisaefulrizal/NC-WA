import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError } from './sessions.js';
import type { IncomingMessage } from './incoming.js';

export class MediaStore {
  constructor(public root: string, private baseUrl: string, private maxBytes = 32 * 1024 * 1024) {}
  async save(sessionId: string, message: IncomingMessage) {
    if (!message.download) return null;
    const id = createHash('sha256').update(`${sessionId}\0${message.messageId}`).digest('hex');
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const temporary = join(this.root, `${id}.${randomUUID()}.part`);
    let size = 0;
    const limit = new Transform({ transform: (chunk, _encoding, callback) => {
      size += chunk.length;
      callback(size > this.maxBytes ? new Error('Media terlalu besar') : null, chunk);
    } });
    const mimetype = /^[\w.+-]+\/[\w.+-]+$/.test(message.mimetype ?? '') ? message.mimetype! : 'application/octet-stream';
    try {
      await pipeline(await message.download(), limit, createWriteStream(temporary, { mode: 0o600, flags: 'wx' }));
      await rename(temporary, join(this.root, id));
      await writeFile(join(this.root, `${id}.json`), JSON.stringify({ mimetype }), { mode: 0o600 });
    } finally { await rm(temporary, { force: true }); }
    return { url: `${this.baseUrl.replace(/\/$/, '')}/media/${id}`, mimetype };
  }
  async get(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(404, 'media_not_found', 'Media tidak ada');
    try {
      const path = join(this.root, id);
      await stat(path);
      const { mimetype } = JSON.parse(await readFile(`${path}.json`, 'utf8'));
      return { path, mimetype: typeof mimetype === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(mimetype) ? mimetype : 'application/octet-stream' };
    } catch { throw new ApiError(404, 'media_not_found', 'Media tidak ada atau sudah kedaluwarsa'); }
  }
}
