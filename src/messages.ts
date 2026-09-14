import { ApiError, type SessionManager } from './sessions.js';
export type MediaType = 'image' | 'document' | 'audio' | 'video';
export type Outbound = { text: string } | { type: MediaType; url: string; caption?: string; filename?: string };
export function object(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_request', 'Body harus objek JSON');
  return body as Record<string, unknown>;
}
export function requiredString(value: unknown, name: string, max = 65536): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, 'invalid_request', `${name} wajib berupa teks dengan panjang maksimal ${max}`);
  return value;
}
export function recipient(value: unknown): string {
  const to = requiredString(value, 'to', 80);
  if (/^[0-9]+(?:-[0-9]+)?@g\.us$/.test(to)) return to;
  if (!/^[1-9][0-9]{5,14}$/.test(to)) throw new ApiError(400, 'invalid_request', 'to harus nomor internasional tanpa +');
  return `${to}@s.whatsapp.net`;
}
export async function sendText(manager: SessionManager, id: string, body: unknown) {
  const input = object(body);
  const jid = recipient(input.to);
  const text = requiredString(input.text, 'text');
  return manager.send(id, jid, { text });
}

export async function sendMedia(manager: SessionManager, id: string, body: unknown) {
  const input = object(body);
  const jid = recipient(input.to);
  const type = requiredString(input.type, 'type');
  if (!['image', 'document', 'audio', 'video'].includes(type)) throw new ApiError(400, 'invalid_request', 'type harus image, document, audio, atau video');
  const url = requiredString(input.url, 'url', 4096);
  try { if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error(); }
  catch { throw new ApiError(400, 'invalid_request', 'url harus HTTP atau HTTPS'); }
  const caption = input.caption === undefined ? undefined : requiredString(input.caption, 'caption');
  const filename = input.filename === undefined ? undefined : requiredString(input.filename, 'filename', 255);
  return manager.send(id, jid, { type: type as MediaType, url, caption, filename });
}
