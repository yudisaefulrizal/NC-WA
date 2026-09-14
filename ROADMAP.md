# NC-WA — Urutan Pengerjaan

Acuan: [SPEC.md](SPEC.md) — aturan kerja: [AGENT.md](AGENT.md)

## 1. Fondasi
- [x] Setup proyek (TypeScript, Express, `.gitignore`)
- [x] Session manager — satu proses, banyak session
- [x] Auth state per session (`useMultiFileAuthState`)
- [ ] Login QR + endpoint `GET /sessions/:id/qr`
- [ ] Halaman QR (polling 2 detik)
- [ ] `POST /sessions`, `GET /sessions`, `GET /sessions/:id`
- [ ] Logout + hapus session
- [ ] Reconnect otomatis, bedakan `loggedOut` dari putus biasa
- [ ] API key middleware

**Uji**
- [agent] Request tanpa API key ditolak 401
- [agent] Session id ganda ditolak 409
- [agent] `GET /sessions/:id` untuk id tidak ada → 404
- [manual] Scan QR dari HP → status jadi `connected`
- [manual] Restart engine → masih connected, tidak minta scan ulang
- [manual] Matikan wifi lalu nyalakan → reconnect sendiri
- [manual] Hapus device dari HP → status `logged_out`, tidak loop reconnect

Gerbang: dua tes manual pertama harus lewat sebelum tahap 2.

## 2. Kirim
- [ ] Kirim teks
- [ ] Kirim media + caption
- [ ] Ke pribadi dan grup
- [ ] Queue + jeda antar pesan

**Uji**
- [agent] Kirim ke session yang belum connected → 409
- [agent] Body tanpa `to` → 400
- [agent] Queue benar-benar memberi jeda antar pesan
- [manual] Teks sampai di HP tujuan
- [manual] Gambar + caption sampai, dokumen bisa dibuka
- [manual] Kirim ke grup sampai

## 3. Terima
- [ ] Tangkap pesan masuk
- [ ] Webhook pesan masuk + status session
- [ ] Retry webhook 3x
- [ ] Simpan media masuk ke disk + `GET /media/:id`
- [ ] Filter private / group per session

**Uji**
- [agent] Webhook gagal → retry 3x lalu berhenti
- [agent] Filter `private` → pesan grup tidak diteruskan
- [agent] `/media/:id` tanpa API key → 401
- [manual] Kirim dari HP → webhook menerima payload
- [manual] Kirim gambar dari HP → URL media bisa diunduh
- [manual] Pesan grup terbaca `isGroup: true` dan `sender` benar

## 4. Presence
- [ ] Tandai dibaca
- [ ] Sedang mengetik (kirim `available` dulu)

**Uji**
- [manual] Tandai dibaca → centang biru muncul di HP pengirim
- [manual] Typing → indikator "sedang mengetik" terlihat di HP tujuan

## 5. UI
- [ ] List session + status
- [ ] Buat session, logout, hapus
- [ ] Atur filter
- [ ] Statistik + `GET /stats`
- [ ] Halaman dokumentasi API

**Uji**
- [agent] `GET /stats` mengembalikan bentuk yang benar
- [manual] Buka dashboard, masukkan API key, list session muncul
- [manual] Pasang nomor baru lewat UI dari awal sampai connected
- [manual] Ubah filter lewat UI, cek berubah di `GET /sessions/:id`

## 6. Rapikan
- [ ] Batasi ukuran request body
- [ ] Validasi URL media keluar
- [ ] Hapus media otomatis (`MEDIA_RETENTION_DAYS`)
- [ ] Log per session
- [ ] `.env.example` + langkah instal
- [ ] README — apa ini, catatan risiko ToS, cara instal,
      cara pasang nomor pertama, tunjuk ke SPEC.md untuk API

**Uji**
- [agent] Body melebihi batas → ditolak
- [agent] URL media ke alamat lokal → ditolak
- [agent] File media lewat masa retensi → terhapus
- [manual] Instal dari nol di server lain, ikuti README apa adanya

---

Halaman QR ikut tahap 1 karena dibutuhkan untuk menguji semua tahap
berikutnya. Sisa UI paling belakang.
