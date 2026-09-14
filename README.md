# NC-WA

Engine WhatsApp multi-session berbasis TypeScript, Express, dan Baileys.
Saat ini tahap 1: pemasangan QR, auth persisten, CRUD session, logout,
reconnect otomatis, dan API key. API pengiriman belum tersedia.

## Menjalankan

Butuh Node.js 22 atau lebih baru. Jalankan satu proses saja.

```sh
npm ci
cp .env.example .env
```

Isi `API_KEY` di `.env` dengan key acak milik sendiri, misalnya hasil
`openssl rand -hex 32`. Jangan bagikan key atau folder `auth/`.

```sh
npm run build
npm start
```

Buka http://127.0.0.1:8066, masukkan API key yang sama dan ID session,
lalu klik **Buat / buka session**. Pindai QR dari menu **Perangkat tertaut**
di WhatsApp HP. Halaman memperbarui QR setiap 2 detik.

Default server hanya mendengarkan localhost. Jika diakses lewat internet,
gunakan reverse proxy HTTPS. Folder `AUTH_DIR` harus permanen saat redeploy.
Jangan menjalankan dua engine pada folder auth yang sama.

## Uji manual tahap 1

1. Pindai QR sampai halaman menunjukkan **WhatsApp tersambung**.
2. Hentikan engine dengan Ctrl+C, jalankan `npm start` kembali, lalu buka
   session yang sama. Pastikan tetap connected tanpa scan ulang.
3. Putuskan jaringan engine lalu pulihkan. Pastikan reconnect otomatis.
4. Hapus perangkat tertaut dari HP. Pastikan status menjadi `logged_out`
   dan engine tidak terus mencoba reconnect.

Dua langkah pertama merupakan gerbang sebelum tahap 2. Laporkan hasilnya
agar pengiriman pesan dapat dilanjutkan. Mematikan Wi-Fi HP saja mungkin
masih menyisakan jaringan seluler; uji putus jaringan engine untuk reconnect.

Endpoint yang tersedia: `POST /sessions`, `GET /sessions`,
`GET /sessions/:id`, `GET /sessions/:id/qr`,
`POST /sessions/:id/logout`, `DELETE /sessions/:id`.
Semua membutuhkan header `X-API-Key`. Detail kontrak ada di [SPEC.md](SPEC.md).
Pembuatan session bisa membalas `connecting` selagi QR disiapkan.
Session yang logged out harus dihapus lalu dibuat ulang untuk scan kembali.
DELETE menutup koneksi dan menghapus data lokal; gunakan logout dahulu
jika ingin sekaligus mencabut perangkat tertaut di HP.

## Pemeriksaan

```sh
npm run check
npm test
npm run build
```

Tes otomatis menggunakan socket tiruan, tanpa menghubungkan nomor nyata.
Untuk pemeriksaan opsional QR melalui jaringan WhatsApp, jalankan
`node scripts/check-qr.mjs` setelah build. Tidak perlu scan; data sementara
dihapus setelah pemeriksaan.
Baileys merupakan integrasi WhatsApp tidak resmi; pemakaian dapat melanggar
ketentuan WhatsApp dan berisiko pembatasan akun.

Panduan kerja: [AGENT.md](AGENT.md). Progres: [ROADMAP.md](ROADMAP.md).
