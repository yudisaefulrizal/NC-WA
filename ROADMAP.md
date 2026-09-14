# NC-WA — Urutan Pengerjaan

Acuan: [SPEC.md](SPEC.md)

## 1. Fondasi
- [ ] Setup proyek (TypeScript, Express, `.gitignore`)
- [ ] Session manager — satu proses, banyak session
- [ ] Auth state per session (`useMultiFileAuthState`)
- [ ] Login QR + endpoint `GET /sessions/:id/qr`
- [ ] Halaman QR (polling 2 detik)
- [ ] `POST /sessions`, `GET /sessions`, `GET /sessions/:id`
- [ ] Logout + hapus session
- [ ] Reconnect otomatis, bedakan `loggedOut` dari putus biasa
- [ ] API key middleware

Selesai kalau: satu nomor connected, dan tetap connected setelah restart.

## 2. Kirim
- [ ] Kirim teks
- [ ] Kirim media + caption
- [ ] Ke pribadi dan grup
- [ ] Queue + jeda antar pesan

## 3. Terima
- [ ] Tangkap pesan masuk
- [ ] Webhook pesan masuk + status session
- [ ] Retry webhook 3x
- [ ] Simpan media masuk ke disk + `GET /media/:id`
- [ ] Filter private / group per session

## 4. Presence
- [ ] Tandai dibaca
- [ ] Sedang mengetik (kirim `available` dulu)

## 5. UI
- [ ] List session + status
- [ ] Buat session, logout, hapus
- [ ] Atur filter
- [ ] Statistik + `GET /stats`
- [ ] Halaman dokumentasi API

## 6. Rapikan
- [ ] Batasi ukuran request body
- [ ] Validasi URL media keluar
- [ ] Hapus media otomatis (`MEDIA_RETENTION_DAYS`)
- [ ] Log per session
- [ ] `.env.example` + langkah instal

---

Halaman QR ikut tahap 1 karena dibutuhkan untuk menguji semua tahap
berikutnya. Sisa UI paling belakang.
