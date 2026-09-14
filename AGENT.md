# Panduan Agent

Dibaca tiap mulai sesi. Perintah "lanjutkan" sudah cukup.

- Apa yang dibangun → [SPEC.md](SPEC.md)
- Urutan pengerjaan → [ROADMAP.md](ROADMAP.md)
- Yang sudah terbukti gagal → [DEBUG.md](DEBUG.md)

---

## Aturan kerja

Tes dibagi dua:
- **[agent]** — tidak butuh WhatsApp nyata. Dikerjakan langsung.
- **[manual]** — butuh HP asli. Dikerjakan pemilik.

Tes `[manual]` boleh ditunda, lanjut ke tahap berikutnya.
Dikumpulkan dan dijalankan belakangan.

**Kecuali satu gerbang:** tahap 1 harus lewat tes manualnya dulu —
satu nomor benar-benar connected — sebelum tahap 2 dimulai. Tahap 2-5
semuanya menumpuk di atas session yang tersambung; kalau fondasinya
belum terbukti, semua yang menempel ikut tersangkut.

Setelah gerbang itu lewat, jalan terus tanpa berhenti.

Tiap percobaan perbaikan yang gagal dicatat di [DEBUG.md](DEBUG.md)
sebelum mencoba pendekatan lain — supaya tidak berputar mengulang
hal yang sudah terbukti tidak berhasil.

Bagian Status di bawah diperbarui tiap selesai satu item.
Harus tetap pendek — rencana ada di roadmap, ini cuma posisi.

---

## Git

Satu item roadmap = satu commit. Riwayat git jadi sejajar dengan
checklist, gampang ditelusuri kalau ada yang rusak.

Pesan commit: judul kalimat perintah bahasa Indonesia ("Tambah...",
"Perbaiki..."), badan menjelaskan **kenapa** — bukan mengulang apa
yang berubah, itu sudah terlihat di diff.

**Push hanya kalau pemilik menyuruh.** Sekali terkirim sulit ditarik.

**Jangan pernah commit** `.env` dan folder auth state — isinya API key
dan kredensial WhatsApp. Pastikan `.gitignore` terpasang sebelum
`git add` pertama di tahap 1.

---

## Status

**Tahap:** 6 — Rapikan
**Sedang dikerjakan:** implementasi selesai; menunggu tes manual

**Sudah selesai:**
- Seluruh implementasi tahap 1–6; 28 tes, build, dan uji browser lolos
- Server terbaru aktif; toko-a tetap connected setelah restart
- Pesan masuk dan pengiriman teks sampai di HP tujuan dikonfirmasi pemilik

**Menunggu pemilik:**
- Uji jaringan/device, media/grup, webhook dan presence
- Uji dashboard dengan HP serta instalasi bersih di server lain

**Berikutnya:** uji media/grup, webhook, presence, dan instalasi
