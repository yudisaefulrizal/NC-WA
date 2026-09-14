# NC-WA — Spesifikasi

Engine di atas Baileys. REST API + webhook. Multi-session.
Broadcast/kontak/jadwal → urusan aplikasi pemakai.

## Session
- [x] Multi-session (beberapa nomor)
- [x] Login QR
- [x] Logout
- [x] Hapus session
- [x] List session + status
- [x] Reconnect otomatis

## Kirim
- [x] Teks
- [x] Media + caption
- [x] Ke pribadi
- [x] Ke grup

## Terima
- [x] Tangkap pesan masuk
- [x] Webhook ke aplikasi pemakai
- [x] Webhook status session
- [x] Retry webhook kalau gagal

## Presence
- [x] Tandai dibaca
- [x] Sedang mengetik

## Infra
- [x] Auth state persisten
- [x] Queue kirim + jeda
- [x] API key
- [x] Log kejadian sistem ke stdout
- [x] Simpan media masuk ke disk
- [x] Hapus media otomatis (`MEDIA_RETENTION_DAYS`, default 7)

## UI
Dashboard internal, satu pemilik, dibuka pakai API key dari env.

- [x] List session + status
- [x] Buat session, tampilkan QR di layar
- [x] Logout / hapus session
- [x] Halaman dokumentasi API
- [x] Statistik (dibaca saat UI dibuka, tidak disimpan)
- [x] Atur filter pribadi / grup per session
- [x] Halaman uji: aliran pesan realtime + kirim pesan (riwayat di browser)

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

## Log

Ke stdout. Kejadian sistem saja, bukan lalu lintas pesan.

Yang dicatat:
- Perubahan status session + alasannya
- Reconnect (percobaan ke berapa, berhasil/gagal)
- Webhook gagal + percobaan ulang
- Error

Tidak dicatat: isi pesan, API key, auth state.
Pesan masuk/keluar tidak dilog sama sekali — itu urusan client.

Tanpa library logger, tanpa level, tanpa file. `console.log`
dengan timestamp dan session id sudah cukup untuk satu proses.

## Glosarium

**Session** — satu nomor WhatsApp yang tersambung ke engine. Punya id
sendiri (`toko-a`), auth state sendiri, dan socket sendiri.

**Auth state** — kredensial hasil scan QR. Disimpan engine sebagai file JSON,
terus-menerus diperbarui Baileys selama session hidup. Hilang = scan ulang.

**JID** — alamat WhatsApp internal. Pribadi `628123@s.whatsapp.net`,
grup `1234567890-1234567@g.us`. Client kirim nomor polos, engine yang
membentuk JID-nya.

**Pairing / scan** — proses menyambungkan nomor lewat QR. Engine jadi
"linked device" dari HP, seperti WhatsApp Web.

**Logout vs disconnect** — logout itu device dihapus dari HP, auth state mati,
harus scan ulang. Disconnect cuma koneksi putus, auth masih sah,
engine tinggal reconnect.

**Client** — aplikasi yang memakai engine ini lewat API. Bukan HP,
bukan browser.

**Engine** — aplikasi ini sendiri. Disebut engine karena tidak punya
logika bisnis: cuma menjalankan perintah per satu pesan.

## Keamanan

- [x] `/media/:messageId` wajib API key — isinya foto/dokumen orang,
      `messageId` sulit ditebak tapi itu bukan kontrol akses
- [x] Batasi ukuran request body — tanpa batas, satu POST besar bisa
      menghabiskan memori
- [x] Validasi URL media keluar — wajib http/https, tolak alamat lokal,
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
PORT=8066
MEDIA_RETENTION_DAYS=7
```

**Kebutuhan server.** Node 22+, 1 core, disk lokal. RAM yang menentukan:
~150 MB per session, bertambah mengikuti jumlah kontak dan anggota grup
yang pernah berinteraksi (kunci enkripsi per lawan bicara dipegang di
memori, tidak dilepas). 1 GB untuk 3–5 session. Batasi heap Node dengan
`NODE_OPTIONS=--max-old-space-size=` sekitar 75% RAM server.

Tetap `useMultiFileAuthState`, bukan SQLite: yang diperbaiki database
hanya pemborosan blok disk, sedangkan salinan kerja tetap di memori.
Pola tulis Baileys yang sangat sering juga lebih aman di file terpisah —
satu file rusak hanya menghilangkan satu kunci, database rusak
menghilangkan seluruh session.

Langkah instal: lihat README.

## Teknologi
- TypeScript
- Baileys
- Auth state: JSON file (`useMultiFileAuthState`)
- Tanpa database

---

# API

Auth: header `X-API-Key`

Nomor ditulis polos: `628123456789`
Grup pakai id grup: `1234567890-1234567@g.us`

## Error

```json
{ "error": "session_not_connected", "message": "Session toko-a belum tersambung" }
```

Client mencocokkan `error`, bukan `message`. Teks `message` bisa berubah.

| `error` | HTTP | Arti |
|---|---|---|
| `unauthorized` | 401 | API key salah atau tidak ada |
| `invalid_request` | 400 | Body tidak sesuai |
| `session_not_found` | 404 | Session id tidak ada |
| `session_exists` | 409 | Session id sudah dipakai |
| `session_not_connected` | 409 | Session ada tapi belum tersambung |
| `invalid_number` | 400 | Nomor tidak terdaftar di WhatsApp |
| `media_not_found` | 404 | File sudah kedaluwarsa atau tidak ada |
| `send_failed` | 502 | Gagal kirim ke WhatsApp |

Tambahan error implementasi: `logout_failed` (502), `queue_full` (503),
`unavailable` (503), `not_found` (404), dan `internal_error` (500).
Body di atas 64 KiB ditolak 413 dengan `invalid_request`.

Berhasil selalu 200. Yang bisa dicoba ulang: `session_not_connected`,
`send_failed`.

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

Respons awal boleh `connecting` saat QR belum tersedia. Poll endpoint QR
untuk menunggu QR atau status connected.

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

### Pasang ulang
`POST /sessions/toko-a/reconnect`
```json
{ "id": "toko-a", "status": "connecting" }
```

Hanya untuk session `logged_out`. Auth state lama dibuang, koneksi baru
dimulai, QR dikeluarkan lagi — id dan filter session tetap. Status lain
ditolak `409 session_not_connected`.

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

Endpoint kirim menunggu sampai pesan benar-benar terkirim, baru membalas.
Antrean dan jeda diurus engine di belakang, jadi request bisa tertahan
beberapa detik kalau sedang ramai. Response 200 = sudah sampai WhatsApp.

### Teks
`POST /sessions/toko-a/messages/text`
```json
{ "to": "628123456789", "text": "halo" }
```
```json
{ "messageId": "3EB0...", "to": "628123456789@s.whatsapp.net" }
```

Ke grup — `to` diisi id grup:
```json
{ "to": "1234567890-1234567@g.us", "text": "halo semua" }
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

Untuk grup yang kunci pesannya belum dikenal setelah restart, tambahkan
`sender` berupa nomor pengirim atau JID LID.

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

`GET /media/:id` → file aslinya. ID dibentuk dari sessionId + messageId;
gunakan URL yang dikembalikan webhook. Wajib `X-API-Key`.

Media masuk disimpan engine ke disk, webhook cuma kirim URL-nya.
Bukan base64 — video besar boros memori, dan memori lebih mahal daripada disk.
File dihapus otomatis setelah `MEDIA_RETENTION_DAYS` (default 7).

---

## Aliran pesan realtime

`GET /events` — Server-Sent Events. Mendorong event yang sama dengan
webhook (`message`, `session.status`, `session.qr`) ke pemanggil yang
sedang terhubung.

Engine tidak menyimpan apa pun untuk ini: event yang lewat saat tidak
ada pemanggil terhubung, hilang. Dipakai halaman uji di dashboard —
riwayatnya disimpan di browser, bukan di engine.

Wajib `X-API-Key`. Karena EventSource tidak bisa mengirim header,
endpoint ini juga menerima key lewat query `?key=`.

Halaman uji menampilkan isi percakapan di layar. Dapat diterima karena
dashboard single-tenant dan terlindungi API key, tapi jangan dibuka di
layar yang terlihat orang lain.

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

Jika WhatsApp hanya memberikan LID tanpa nomor alternatif, `from`/`sender`
mempertahankan akhiran `@lid`. Endpoint read menerima alamat LID tersebut.

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
