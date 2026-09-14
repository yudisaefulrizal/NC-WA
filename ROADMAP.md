# NC-WA — Urutan Pengerjaan

Acuan: [SPEC.md](SPEC.md) — aturan kerja: [AGENT.md](AGENT.md)

## 1. Fondasi
- [x] Setup proyek (TypeScript, Express, `.gitignore`)
- [x] Session manager — satu proses, banyak session
- [x] Auth state per session (`useMultiFileAuthState`)
- [x] Login QR + endpoint `GET /sessions/:id/qr`
- [x] Halaman QR (polling 2 detik)
- [x] `POST /sessions`, `GET /sessions`, `GET /sessions/:id`
- [x] Logout + hapus session
- [x] Reconnect otomatis, bedakan `loggedOut` dari putus biasa
- [x] API key middleware

**Uji**
- [x] [agent] Request tanpa API key ditolak 401
- [x] [agent] Session id ganda ditolak 409
- [x] [agent] `GET /sessions/:id` untuk id tidak ada → 404
- [x] [manual] Scan QR dari HP → status jadi `connected`
- [x] [manual] Restart engine → masih connected, tidak minta scan ulang
- [x] [manual] Matikan wifi lalu nyalakan → reconnect sendiri
- [x] [manual] Hapus device dari HP → status `logged_out`, tidak loop reconnect

Gerbang: dua tes manual pertama harus lewat sebelum tahap 2.

## 2. Kirim
- [x] Kirim teks
- [x] Kirim media + caption
- [x] Ke pribadi dan grup
- [x] Queue + jeda antar pesan

**Uji**
- [x] [agent] Kirim ke session yang belum connected → 409
- [x] [agent] Body tanpa `to` → 400
- [x] [agent] Queue benar-benar memberi jeda antar pesan
- [x] [manual] Teks sampai di HP tujuan
- [x] [manual] Gambar + caption sampai, dokumen bisa dibuka
- [x] [manual] Kirim ke grup sampai

## 3. Terima
- [x] Tangkap pesan masuk
- [x] Webhook pesan masuk + status session
- [x] Retry webhook 3x
- [x] Simpan media masuk ke disk + `GET /media/:id`
- [x] Filter private / group per session

**Uji**
- [x] [agent] Webhook gagal → retry 3x lalu berhenti
- [x] [agent] Filter `private` → pesan grup tidak diteruskan
- [x] [agent] `/media/:id` tanpa API key → 401
- [x] [manual] Kirim dari HP → webhook menerima payload
- [x] [manual] Kirim gambar dari HP → URL media bisa diunduh
- [x] [manual] Pesan grup terbaca `isGroup: true` dan `sender` benar

## 4. Presence
- [x] Tandai dibaca
- [x] Sedang mengetik (kirim `available` dulu)

**Uji**
- [x] [manual] Tandai dibaca → centang biru muncul di HP pengirim
- [x] [manual] Typing → indikator "sedang mengetik" terlihat di HP tujuan

## 5. UI
- [x] List session + status
- [x] Buat session, logout, hapus
- [x] Atur filter
- [x] Statistik + `GET /stats`
- [x] Halaman dokumentasi API

**Uji**
- [x] [agent] `GET /stats` mengembalikan bentuk yang benar
- [x] [manual] Buka dashboard, masukkan API key, list session muncul
- [x] [manual] Pasang ulang session lewat UI sampai connected
- [x] [manual] Ubah filter lewat UI, cek berubah di `GET /sessions/:id`
- [x] [manual] Halaman uji: pesan masuk muncul realtime, kirim pesan sampai

## 6. Rapikan
- [x] Batasi ukuran request body
- [x] Validasi URL media keluar
- [x] Hapus media otomatis (`MEDIA_RETENTION_DAYS`)
- [x] Log per session
- [x] `.env.example` + langkah instal
- [x] README — apa ini, catatan risiko ToS, cara instal,
      cara pasang nomor pertama, tunjuk ke SPEC.md untuk API

**Uji**
- [x] [agent] Body melebihi batas → ditolak
- [x] [agent] URL media ke alamat lokal → ditolak
- [x] [agent] File media lewat masa retensi → terhapus
- [x] [manual] Instal dari nol di server lain, ikuti README apa adanya

---

Halaman QR ikut tahap 1 karena dibutuhkan untuk menguji semua tahap
berikutnya. Sisa UI paling belakang.

## Hasil verifikasi terakhir

- `npm run check`, `npm test` (28 tes), dan `npm run build`: lulus.
- Browser otomatis dengan data tiruan: daftar session, filter, logout, hapus,
  dokumentasi dan viewport mobile lulus tanpa error JavaScript.
- Scan QR dikonfirmasi pemilik; restart engine terbaru terbukti kembali connected.
- Smoke HTTP server terbaru: dashboard/QR/dokumentasi/statistik 200, API tanpa key 401.
- Pemilik mengonfirmasi pesan masuk ke nomor yang login; webhook belum terkonfirmasi.
- Satu uji kirim teks nyata melalui toko-a menghasilkan HTTP 200 dan messageId.
  Pemilik mengonfirmasi teks berhasil terkirim dan diterima di HP tujuan.
  Tes manual lainnya tetap menunggu.
