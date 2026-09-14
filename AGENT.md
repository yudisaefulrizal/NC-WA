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

## Status

**Tahap:** 1 — Fondasi
**Sedang dikerjakan:** belum mulai

**Sudah selesai:**
- Spesifikasi, roadmap, logo

**Menunggu pemilik:**
- (belum ada)

**Berikutnya:** setup proyek — TypeScript, Express, `.gitignore`
