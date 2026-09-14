// Only pass system descriptions; never message bodies, keys, URLs, or auth objects.
export function log(sessionId: string | undefined, message: string) {
  console.log(`${new Date().toISOString()} [${sessionId ?? 'engine'}] ${message}`);
}
