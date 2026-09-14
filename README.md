# NC-WA

Gateway WhatsApp multi-session berbasis TypeScript, Express, dan Baileys.
Satu proses menyediakan REST API, webhook, dan dashboard HTML/JS tanpa framework.
Tanpa database, akun pengguna, atau logika broadcast/jadwal.

Fitur: QR dan auth persisten per nomor, reconnect, teks/media ke pribadi atau
grup, antrean kirim, webhook pesan/status/QR, filter, receipt dibaca, presence,
media masuk di disk, statistik, dan dokumentasi API di `/docs.html`.

## Instalasi

Butuh Node.js 22 atau lebih baru dan akses jaringan ke WhatsApp. Gunakan satu
proses saja: jangan memakai PM2 cluster atau berbagi folder auth antar engine.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Isi `API_KEY` di `.env` dengan hasil perintah terakhir. Jangan commit atau
membagikan `.env` dan folder auth; keduanya sudah masuk `.gitignore`.

```sh
npm run build
npm start
```

Buka http://127.0.0.1:8066 dan masukkan API key tersebut. Klik **Pasangkan nomor**,
isi ID session, lalu scan QR melalui WhatsApp HP → **Perangkat tertaut** →
**Tautkan perangkat**. Tunggu sampai status **Tersambung**. QR otomatis diperbarui.

Untuk pengembangan: `npm run dev`. Setelah perubahan kode produksi, jalankan
`npm run build` dan restart `npm start`. Ctrl+C menghentikan socket dan menyimpan
kredensial; restart memakai auth sebelumnya tanpa scan ulang.

## Kebutuhan server

Node.js 22+, 1 CPU core, disk lokal (bukan NFS — auth state berupa ribuan
file kecil). Koneksi stabil lebih penting daripada cepat: engine memegang
WebSocket terus-menerus.

RAM adalah batas yang menentukan. Satu session terukur ~150 MB, dan
bertambah seiring banyaknya kontak dan anggota grup yang pernah
berinteraksi — kunci enkripsi per lawan bicara disimpan di memori dan
tidak dilepas. Pemakaian naik lalu mendatar, bukan naik-turun.

| Session | RAM disarankan |
|---|---|
| 1–2 | 512 MB (tanpa margin) |
| 3–5 | 1 GB |
| lebih | 2 GB |

Batasi heap Node agar proses membersihkan memori sebelum dibunuh OOM
killer — kira-kira 75% RAM server:

```sh
NODE_OPTIONS=--max-old-space-size=768 npm start
```

Disk: `node_modules` ~130 MB. Auth state ~50 MB per session di disk
(isinya hanya ~1 MB; sisanya blok terbuang karena ribuan file mungil).
Media masuk mengikuti lalu lintas dan `MEDIA_RETENTION_DAYS`. 10–20 GB
lapang untuk pemakaian normal.

## Konfigurasi

| Env | Default | Kegunaan |
| --- | --- | --- |
| `API_KEY` | wajib diisi | Header `X-API-Key` untuk seluruh API |
| `PORT` | `8066` | Port HTTP |
| `HOST` | `127.0.0.1` | Alamat listen, localhost secara default |
| `AUTH_DIR` | `./auth` | Auth dan metadata session, harus permanen |
| `MEDIA_DIR` | `./data/media` | File media masuk, harus permanen |
| `MEDIA_RETENTION_DAYS` | `7` | Usia media sebelum dihapus |
| `WEBHOOK_URL` | kosong | Tujuan POST webhook; kosong menonaktifkan webhook |
| `BASE_URL` | `http://127.0.0.1:8066` | Origin engine yang dapat dijangkau penerima webhook |
| `SEND_INTERVAL_MS` | `1000` | Jeda setelah pengiriman selesai, per session |

BASE_URL harus berupa origin tanpa path atau query. Contoh:
`https://wa.example.com`. Jika mengubah port, sesuaikan BASE_URL di `.env`.
Jika dibuka melalui internet, gunakan reverse proxy HTTPS. API key disimpan
browser di localStorage sesuai spesifikasi; gunakan browser/perangkat tepercaya.

Jika memakai container, petakan AUTH_DIR dan MEDIA_DIR sebagai volume. Backup
kedua direktori dan `.env` secara privat; jangan menimpanya saat redeploy.
Auth berbasis file mengikuti `useMultiFileAuthState`, sesuai kebutuhan satu proses.

## REST API

Kontrak lengkap: [SPEC.md](SPEC.md), atau [halaman dokumentasi lokal](http://127.0.0.1:8066/docs.html).
Header `X-API-Key` wajib, termasuk untuk mengunduh media. Jangan taruh key di URL.

```sh
curl http://127.0.0.1:8066/sessions \
  -H 'X-API-Key: KEY_ANDA'

curl http://127.0.0.1:8066/sessions/toko-a/messages/text \
  -H 'X-API-Key: KEY_ANDA' -H 'Content-Type: application/json' \
  -d '{"to":"628123456789","text":"Halo"}'
```

Nomor ditulis internasional tanpa `+`; tujuan grup memakai JID `...@g.us`.
Body dibatasi 64 KiB. URL media harus HTTP/HTTPS publik; IP lokal, redirect
internal, serta perubahan DNS tidak dapat dipakai untuk menjangkau server lokal.
Unduhan media dibatasi 32 MiB dan dialirkan ke disk sementara.

Request kirim menunggu antrean dan respons WhatsApp. Respons 200 berarti
WhatsApp menerima pengiriman, bukan bukti pesan sudah dibaca di HP. Antrean
maksimal 256 pekerjaan per session; penuh menghasilkan 503 `queue_full`.
Jangan otomatis mengulang request timeout karena pesan mungkin sudah terkirim.

Logout mencabut device di WhatsApp. DELETE menutup socket dan menghapus auth
lokal; logout dahulu jika ingin sekaligus mencabut perangkat dari HP.
Session logged_out harus dihapus lalu dibuat ulang untuk scan kembali.

## Webhook dan media masuk

Isi WEBHOOK_URL dengan endpoint aplikasi pemakai. Event: `message`,
`session.status`, `session.qr`. Webhook gagal dicoba ulang 3 kali dengan jeda
1, 2, 4 detik; timeout tiap percobaan 10 detik. Redirect webhook tidak diikuti.
Retry dan statistik hanya ada di memori; restart tidak mengulang event yang
belum selesai. Penerima sebaiknya idempoten berdasarkan sessionId + messageId.

Filter `all`, `private`, atau `group` tersimpan per session. Pesan sendiri,
riwayat sinkronisasi, status broadcast, dan newsletter tidak diteruskan.
Pesan grup membawa groupId dan sender. Pada akun dengan alamat LID, engine
menggunakan nomor alternatif jika tersedia; bila belum tersedia, akhiran
`@lid` dipertahankan agar tidak disalahartikan sebagai nomor telepon.

Media masuk disimpan di disk; webhook membawa URL beserta mimetype, bukan
base64. ID media memisahkan session untuk mencegah benturan messageId.
Gunakan URL persis dari webhook untuk mengunduh dengan API key. Media yang
sudah kedaluwarsa menghasilkan 404; pembersihan berlangsung saat startup dan
setiap jam. Statistik `received` menghitung pesan yang dikenali sebelum filter.

Tidak ada isi pesan atau kredensial dalam log aplikasi. Log sistem memakai
stdout dengan timestamp dan ID session; log detail library yang bisa membawa
kredensial dinonaktifkan.

## Pemeriksaan

```sh
npm run check
npm test
npm run build
```

Tes otomatis memakai socket dan webhook tiruan. Untuk pemeriksaan opsional
QR lewat jaringan WhatsApp (tanpa scan akun), jalankan setelah build:

```sh
node scripts/check-qr.mjs
```

Pemeriksaan HP yang tetap diperlukan:

1. Scan lalu restart engine tanpa scan ulang — sudah berhasil pada session `toko-a`.
2. Putuskan jaringan engine lalu pulihkan; pastikan reconnect. Cabut device
   melalui HP untuk memeriksa `logged_out` tanpa loop reconnect.
3. Uji teks, gambar/caption, dokumen, dan tujuan grup dengan nomor yang ditentukan.
4. Uji webhook teks/media/grup, receipt dibaca, dan indikator mengetik dari HP.
5. Uji pemasangan nomor baru dan filter melalui dashboard, lalu instal dari nol
   pada server lain dengan panduan ini.

Checklist terperinci ada di [ROADMAP.md](ROADMAP.md); tes yang belum dilakukan
belum ditandai lulus. Panduan kerja: [AGENT.md](AGENT.md).

## Catatan penggunaan

Baileys adalah integrasi WhatsApp tidak resmi. Pemakaian dapat melanggar
ketentuan WhatsApp dan berisiko pembatasan akun. Gunakan secara bertanggung
jawab dan hanya kirim pesan kepada tujuan yang mengizinkan komunikasi.
Referensi library: [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys).
