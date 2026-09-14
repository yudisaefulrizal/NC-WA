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
**Sedang dikerjakan:** uji manual bersama pemilik

**Sudah selesai:**
- Implementasi tahap 1–6; 30 tes, build, dan tipe lolos
- Tahap 1–4 tuntas diuji dengan WhatsApp nyata: reconnect, logout,
  teks, media, grup, webhook, filter, read, typing
- Dashboard: logout, hapus, dan pasang ulang session terbukti jalan

**Menunggu pemilik** (panduan: [UJI-MANUAL.md](UJI-MANUAL.md)):
- Pasang nomor baru lewat UI sampai connected
- Ubah filter lewat UI
- Instalasi bersih di server lain

**Berikutnya:** sisa uji dashboard, lalu deploy
