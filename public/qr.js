const form = document.querySelector('#pair-form');
const keyInput = document.querySelector('#api-key');
const idInput = document.querySelector('#session-id');
const statusEl = document.querySelector('#status');
const qrEl = document.querySelector('#qr');
try { keyInput.value = localStorage.getItem('nc-wa-api-key') || ''; } catch {}
let generation = 0;
let timer;
async function api(path, key, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-API-Key': key, 'Content-Type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || 'Request gagal'), { code: body.error });
  return body;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const current = ++generation;
  clearTimeout(timer);
  qrEl.hidden = true;
  const key = keyInput.value;
  const id = idInput.value;
  try { localStorage.setItem('nc-wa-api-key', key); } catch {}
  statusEl.textContent = 'Menyiapkan session…';
  try {
    try { await api('/sessions', key, { method: 'POST', body: JSON.stringify({ id }) }); }
    catch (error) { if (error.code !== 'session_exists') throw error; }
    async function poll() {
      if (current !== generation) return;
      try {
        const result = await api(`/sessions/${encodeURIComponent(id)}/qr`, key);
        if (current !== generation) return;
        qrEl.hidden = !result.qr;
        if (result.qr) qrEl.src = result.qr;
        statusEl.textContent = {
          connected: 'WhatsApp tersambung. Session siap digunakan.',
          qr_required: 'Pindai QR dari HP Anda.',
          connecting: 'Menghubungkan ke WhatsApp…',
          logged_out: 'Session sudah logout. Hapus session lewat API lalu buat ulang untuk memasangkan lagi.',
        }[result.status] || result.status;
        if (result.status === 'connected' || result.status === 'logged_out') return;
      } catch (error) {
        if (current !== generation) return;
        qrEl.hidden = true;
        statusEl.textContent = error.message;
        if (error.code === 'unauthorized' || error.code === 'session_not_found') return;
      }
      timer = setTimeout(poll, 2000);
    }
    await poll();
  } catch (error) { if (current === generation) statusEl.textContent = error.message; }
});

const selectedSession = new URLSearchParams(location.search).get('session');
if (selectedSession) {
  idInput.value = selectedSession;
  if (keyInput.value) form.requestSubmit();
}
