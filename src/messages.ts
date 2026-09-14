import { ApiError, type SessionManager } from './sessions.js';
export type Outbound = { text: string };
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
  if (!/^[1-9][0-9]{5,14}$/.test(to)) throw new ApiError(400, 'invalid_request', 'to harus nomor internasional tanpa +');
  return `${to}@s.whatsapp.net`;
}
export async function sendText(manager: SessionManager, id: string, body: unknown) {
  const input = object(body);
  const jid = recipient(input.to);
  const text = requiredString(input.text, 'text');
  return manager.send(id, jid, { text });
}
