const keyInput = document.querySelector('#api-key');
const notice = document.querySelector('#notice');
const feed = document.querySelector('#feed');
const empty = document.querySelector('#empty');
const streamState = document.querySelector('#stream-state');
const sessionSelect = document.querySelector('#session');
const toInput = document.querySelector('#to');
const textInput = document.querySelector('#text');
const sendButton = document.querySelector('#send');
const clearButton = document.querySelector('#clear');
const accessForm = document.querySelector('#access-form');
const composer = document.querySelector('#composer');
const feedPanel = document.querySelector('#feed-panel');
const feedCount = document.querySelector('#feed-count');

const RIWAYAT = 'nc-wa-uji-riwayat';
const BATAS = 100;
let key = '';
let stream;
let riwayat = [];

try { keyInput.value = localStorage.getItem('nc-wa-api-key') || ''; } catch {}
try { riwayat = JSON.parse(localStorage.getItem(RIWAYAT) || '[]'); } catch {}

function simpan() {
  // Riwayat tinggal di browser; engine tidak pernah menyimpan pesan.
  try { localStorage.setItem(RIWAYAT, JSON.stringify(riwayat.slice(-BATAS))); } catch {}
}

function waktu(detik) {
  return new Date((detik ? detik * 1000 : Date.now())).toLocaleTimeString('id-ID');
}

function gambar(entri) {
  const item = document.createElement('li');
  item.className = `feed-item ${entri.arah}`;
  const kepala = document.createElement('div');
  kepala.className = 'feed-head';
  const asal = entri.arah === 'masuk'
    ? `${entri.sender || entri.from}${entri.isGroup ? ' · grup' : ''}`
    : `ke ${entri.to}`;
  kepala.textContent = `${entri.arah === 'masuk' ? '↓' : '↑'} ${asal} · ${entri.sessionId} · ${waktu(entri.timestamp)}`;
  const isi = document.createElement('div');
  isi.className = 'feed-body';
  isi.textContent = entri.text || `(${entri.type || 'media'})`;
  item.append(kepala, isi);
  if (entri.media?.url) {
    const tautan = document.createElement('a');
    tautan.href = '#';
    tautan.textContent = `Unduh ${entri.media.mimetype || 'media'}`;
    tautan.addEventListener('click', async event => {
      event.preventDefault();
      // Media butuh API key, jadi ambil lewat fetch lalu buka sebagai blob.
      try {
        const response = await fetch(entri.media.url, { headers: { 'X-API-Key': key } });
        if (!response.ok) throw new Error('Gagal mengunduh media');
        const url = URL.createObjectURL(await response.blob());
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) { notice.textContent = error.message; }
    });
    item.append(tautan);
  }
  return item;
}

function tambah(entri) {
  riwayat.push(entri);
  if (riwayat.length > BATAS) riwayat = riwayat.slice(-BATAS);
  simpan();
  feed.prepend(gambar(entri));
  while (feed.children.length > BATAS) feed.lastElementChild.remove();
  empty.hidden = true;
  feedCount.textContent = riwayat.length;
}

function gambarUlang() {
  feed.replaceChildren(...riwayat.slice().reverse().map(gambar));
  empty.hidden = riwayat.length > 0;
  feedCount.textContent = riwayat.length;
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-API-Key': key, 'Content-Type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request gagal');
  return body;
}

async function muatSession() {
  const sessions = await api('/sessions');
  const dipilih = sessionSelect.value;
  sessionSelect.replaceChildren(...sessions.map(session => {
    const option = document.createElement('option');
    option.value = session.id;
    option.textContent = `${session.id}${session.status === 'connected' ? '' : ` (${session.status})`}`;
    option.disabled = session.status !== 'connected';
    return option;
  }));
  if (dipilih) sessionSelect.value = dipilih;
  if (!sessions.some(session => session.status === 'connected')) {
    notice.textContent = 'Tidak ada session tersambung. Pasangkan nomor di dashboard terlebih dahulu.';
  }
}

function sambung() {
  stream?.close();
  streamState.textContent = 'menghubungkan…';
  stream = new EventSource(`/events?key=${encodeURIComponent(key)}`);
  stream.onopen = () => { streamState.textContent = 'tersambung'; streamState.className = 'badge connected'; notice.textContent = ''; };
  stream.onerror = () => { streamState.textContent = 'terputus — mencoba lagi'; streamState.className = 'badge logged_out'; };
  stream.onmessage = pesan => {
    let payload;
    try { payload = JSON.parse(pesan.data); } catch { return; }
    if (payload.event !== 'message') return;
    tambah({ ...payload, arah: 'masuk' });
  };
}

function terapkanKey(nilai) {
  key = nilai.trim();
  try { localStorage.setItem('nc-wa-api-key', key); } catch {}
  stream?.close();
  streamState.textContent = 'terputus';
  streamState.className = 'badge';
  if (!key) {
    composer.hidden = feedPanel.hidden = true;
    notice.textContent = 'Masukkan API key untuk mulai.';
    return;
  }
  muatSession()
    .then(() => { composer.hidden = feedPanel.hidden = false; sambung(); })
    .catch(error => { composer.hidden = feedPanel.hidden = true; notice.textContent = error.message; });
}

sendButton.addEventListener('click', async () => {
  const to = toInput.value.trim();
  const text = textInput.value;
  if (!sessionSelect.value) { notice.textContent = 'Pilih session yang tersambung.'; return; }
  if (!to || !text.trim()) { notice.textContent = 'Isi tujuan dan pesan.'; return; }
  sendButton.disabled = true;
  try {
    const hasil = await api(`/sessions/${encodeURIComponent(sessionSelect.value)}/messages/text`, {
      method: 'POST', body: JSON.stringify({ to, text }),
    });
    tambah({ arah: 'keluar', sessionId: sessionSelect.value, to: hasil.to, text, type: 'text' });
    textInput.value = '';
    notice.textContent = '';
  } catch (error) { notice.textContent = error.message; }
  finally { sendButton.disabled = false; }
});

clearButton.addEventListener('click', () => {
  riwayat = [];
  simpan();
  gambarUlang();
});

accessForm.addEventListener('submit', event => { event.preventDefault(); terapkanKey(keyInput.value); });
gambarUlang();
if (keyInput.value) terapkanKey(keyInput.value); else notice.textContent = 'Masukkan API key untuk mulai.';
