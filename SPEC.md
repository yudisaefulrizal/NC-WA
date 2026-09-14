# NC-WA — Spesifikasi

Engine di atas Baileys. REST API + webhook. Multi-session.
Broadcast/kontak/jadwal → urusan aplikasi pemakai.

## Session
- [ ] Multi-session (beberapa nomor)
- [ ] Login QR
- [ ] Logout
- [ ] Hapus session
- [ ] List session + status
- [ ] Reconnect otomatis

## Kirim
- [ ] Teks
- [ ] Media + caption
- [ ] Ke pribadi
- [ ] Ke grup

## Terima
- [ ] Tangkap pesan masuk
- [ ] Webhook ke aplikasi pemakai
- [ ] Webhook status session
- [ ] Retry webhook kalau gagal

## Presence
- [ ] Tandai dibaca
- [ ] Sedang mengetik

## Infra
- [ ] Auth state persisten
- [ ] Queue kirim + jeda
- [ ] API key
- [ ] Log per session
- [ ] Simpan media masuk ke disk
- [ ] Hapus media otomatis (`MEDIA_RETENTION_DAYS`, default 7)

## UI
Dashboard internal, satu pemilik, dibuka pakai API key dari env.

- [ ] List session + status
- [ ] Buat session, tampilkan QR di layar
- [ ] Logout / hapus session
- [ ] Halaman dokumentasi API
- [ ] Statistik (dibaca saat UI dibuka, tidak disimpan)
- [ ] Atur filter pribadi / grup per session

Tanpa user, tanpa login, tanpa manajemen key.
Satu instalasi = satu pemilik. Orang lain instal sendiri.

HTML + JS polos, di-serve langsung oleh engine. Tanpa framework,
tanpa build step. Satu proses, satu port.

QR kedaluwarsa ~20 detik lalu Baileys mengeluarkan yang baru —
halaman QR harus memperbarui gambarnya otomatis, bukan sekali tampil.

Auth UI: halaman minta API key sekali, simpan di `localStorage`,
dipakai sebagai header `X-API-Key` di tiap panggilan.
Key-nya sama dengan yang dipakai aplikasi client.

Kalau diakses dari internet (bukan localhost), wajib HTTPS —
tanpa itu key lewat jaringan dalam bentuk polos.

## Keamanan

- [ ] `/media/:messageId` wajib API key — isinya foto/dokumen orang,
      `messageId` sulit ditebak tapi itu bukan kontrol akses
- [ ] Batasi ukuran request body — tanpa batas, satu POST besar bisa
      menghabiskan memori
- [ ] Validasi URL media keluar — wajib http/https, tolak alamat lokal,
      supaya engine tidak bisa disuruh mengambil alamat internal server

Tanpa rate limiting: satu pemilik, satu key, dan queue sudah membatasi laju.

Yang paling berpengaruh bukan kode: kalau aplikasi client jalan di server
yang sama, dengarkan di localhost saja. Jangan buka ke internet kalau tidak perlu.

## Deploy

**Satu proses saja.** Socket hidup di memori, dua instance tidak boleh pegang
session yang sama. Jangan PM2 cluster mode, jangan scaling horizontal.

**Folder yang harus permanen** (selamat waktu restart / redeploy):
- auth state per session
- media masuk

Kalau pakai Docker, ini volume. Kalau tidak, jangan taruh di direktori
yang tertimpa waktu update.

**Env:**
```
API_KEY=
WEBHOOK_URL=
PORT=3000
MEDIA_RETENTION_DAYS=7
```

Langkah instal ditulis setelah kodenya jadi.

## Teknologi
- TypeScript
- Baileys
- Auth state: JSON file (`useMultiFileAuthState`)
- Tanpa database

---

# API

Auth: header `X-API-Key`
Error: `{ "error": "pesan" }`

Nomor ditulis polos: `628123456789`
Grup pakai id grup: `1234567890-1234567@g.us`

---

## Session

### Buat session
`POST /sessions`
```json
{ "id": "toko-a" }
```
```json
{ "id": "toko-a", "status": "qr_required" }
```

### Ambil QR
`GET /sessions/toko-a/qr`

Belum discan:
```json
{ "status": "qr_required", "qr": "data:image/png;base64,..." }
```

Sudah discan:
```json
{ "status": "connected", "qr": null }
```

QR kedaluwarsa ~20 detik lalu Baileys mengeluarkan yang baru.
Pemanggil polling endpoint ini tiap 2 detik, berhenti waktu `status`
jadi `connected`. Status ikut di response yang sama supaya pemanggil
tidak kehilangan jejak tepat setelah scan.

### List session
`GET /sessions`
```json
[
  { "id": "toko-a", "status": "connected", "phone": "628123456789" },
  { "id": "toko-b", "status": "qr_required", "phone": null }
]
```

### Detail session
`GET /sessions/toko-a`
```json
{
  "id": "toko-a",
  "status": "connected",
  "phone": "628123456789",
  "filter": "all"
}
```

### Logout
`POST /sessions/toko-a/logout`
```json
{ "id": "toko-a", "status": "logged_out" }
```

### Hapus session
`DELETE /sessions/toko-a`
```json
{ "deleted": true }
```

Status: `qr_required` | `connecting` | `connected` | `logged_out`

### Atur filter pesan masuk
`PUT /sessions/toko-a/filter`
```json
{ "filter": "private" }
```
```json
{ "id": "toko-a", "filter": "private" }
```

`filter`: `all` | `private` | `group` (default `all`)

Pesan tetap diterima WhatsApp, engine cuma memilih tidak meneruskan ke webhook.
Disimpan di file JSON bareng auth state, jadi selamat waktu restart.

---

## Statistik

`GET /stats`
```json
{
  "uptime": 86400,
  "sessions": { "total": 3, "connected": 2, "logged_out": 1 },
  "messages": { "sent": 152, "received": 89 }
}
```

Dihitung sejak engine start, disimpan di memori. Reset waktu restart.

---

## Kirim

### Teks
`POST /sessions/toko-a/messages/text`
```json
{ "to": "628123456789", "text": "halo" }
```
```json
{ "messageId": "3EB0...", "to": "628123456789@s.whatsapp.net" }
```

### Media
`POST /sessions/toko-a/messages/media`
```json
{
  "to": "628123456789",
  "type": "image",
  "url": "https://contoh.com/foto.jpg",
  "caption": "ini fotonya",
  "filename": "foto.jpg"
}
```
```json
{ "messageId": "3EB0...", "to": "628123456789@s.whatsapp.net" }
```

`type`: `image` | `document` | `audio` | `video`
`caption` opsional. `filename` untuk document.

---

## Presence

### Tandai dibaca
`POST /sessions/toko-a/read`
```json
{ "from": "628123456789", "messageId": "3EB0..." }
```
```json
{ "ok": true }
```

### Sedang mengetik
`POST /sessions/toko-a/typing`
```json
{ "to": "628123456789", "state": "composing" }
```
```json
{ "ok": true }
```

`state`: `composing` | `paused`

Engine kirim `available` dulu sebelum `composing` — indikator mengetik
sering tidak muncul di HP penerima kalau nomornya terlihat offline.

---

## Media masuk

`GET /media/:messageId` → file aslinya. Wajib `X-API-Key`.

Media masuk disimpan engine ke disk, webhook cuma kirim URL-nya.
Bukan base64 — video besar boros memori, dan memori lebih mahal daripada disk.
File dihapus otomatis setelah `MEDIA_RETENTION_DAYS` (default 7).

---

## Webhook

Engine POST ke `WEBHOOK_URL` dari env. Satu URL untuk semua session.
Kalau gagal, coba ulang 3x dengan jeda.

### Pesan masuk
```json
{
  "event": "message",
  "sessionId": "toko-a",
  "messageId": "3EB0...",
  "from": "628123456789",
  "isGroup": false,
  "groupId": null,
  "sender": "628123456789",
  "type": "text",
  "text": "halo",
  "media": null,
  "timestamp": 1757808000
}
```

Kalau grup: `isGroup: true`, `groupId` diisi, `sender` = pengirim di dalam grup.

Kalau media:
```json
{
  "type": "image",
  "text": "ini captionnya",
  "media": { "url": "https://engine/media/3EB0...", "mimetype": "image/jpeg" }
}
```

`type`: `text` | `image` | `document` | `audio` | `video`

### Status session berubah
```json
{
  "event": "session.status",
  "sessionId": "toko-a",
  "status": "connected",
  "phone": "628123456789"
}
```

### QR baru
```json
{
  "event": "session.qr",
  "sessionId": "toko-a",
  "qr": "data:image/png;base64,..."
}
```
