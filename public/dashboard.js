const keyInput = document.querySelector('#api-key');
const notice = document.querySelector('#notice');
const tbody = document.querySelector('#sessions');
const empty = document.querySelector('#empty');
let key = '';
let timer;
let signature = '';
let generation = 0;
const labels = { connected: 'Tersambung', connecting: 'Menghubungkan', qr_required: 'Perlu scan QR', logged_out: 'Logout' };
try { keyInput.value = localStorage.getItem('nc-wa-api-key') || ''; } catch {}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-API-Key': key, 'Content-Type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request gagal');
  return body;
}
function cell(row, text) { const td = row.insertCell(); td.textContent = text; return td; }
function render(sessions) {
  const next = JSON.stringify(sessions);
  if (signature === next) return;
  signature = next;
  tbody.replaceChildren();
  document.querySelector('#session-count').textContent = sessions.length;
  empty.hidden = sessions.length > 0;
  if (!sessions.length) { empty.querySelector('h3').textContent = 'Belum ada session'; empty.querySelector('p').textContent = 'Pasangkan nomor pertama untuk mulai menggunakan gateway.'; }
  for (const session of sessions) {
    const row = tbody.insertRow();
    cell(row, session.id);
    cell(row, session.phone || '—');
    const status = document.createElement('span');
    status.className = `badge ${session.status}`;
    status.textContent = labels[session.status] || session.status;
    cell(row, '').append(status);
    const actions = document.createElement('div'); actions.className = 'actions';
    const link = document.createElement('a'); link.href = `/qr.html?session=${encodeURIComponent(session.id)}`; link.textContent = 'Buka QR';
    actions.append(link);
    cell(row, '').append(actions);
  }
}
async function refresh() {
  if (!key) return;
  clearTimeout(timer);
  const current = ++generation;
  try {
    const sessions = await api('/sessions');
    if (current !== generation) return;
    render(sessions);
    notice.textContent = `Terakhir diperbarui ${new Date().toLocaleTimeString('id-ID')}`;
  } catch (error) { if (current === generation) notice.textContent = error.message; }
  if (current === generation) timer = setTimeout(refresh, 5000);
}
document.querySelector('#access-form').addEventListener('submit', event => {
  event.preventDefault();
  key = keyInput.value;
  try { localStorage.setItem('nc-wa-api-key', key); } catch {}
  signature = '';
  void refresh();
});
document.querySelector('#refresh').addEventListener('click', refresh);
if (keyInput.value) document.querySelector('#access-form').requestSubmit();
