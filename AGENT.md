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

**Tahap:** 7 — webhook lewat API. Uji `[agent]` lulus, menunggu uji manual.

**Sudah selesai:**
- Seluruh tahap 1–6; 33 tes, build, dan tipe lolos
- Semua uji manual lulus dengan WhatsApp nyata: reconnect, logout,
  pasang ulang, teks, media, grup, webhook, filter, read, typing,
  dashboard, dan halaman uji realtime
- Terpasang di server lewat aaPanel Node project (mode default, bukan
  PM2 cluster), Node v22.23.2, user www, port 8066 di localhost
- Diakses lewat Cloudflare Tunnel dengan HTTPS; port tidak dibuka
- Kirim dan terima pesan terkonfirmasi di server

- Tahap 7: `GET/POST/DELETE /webhooks`, langganan disimpan di
  `WEBHOOK_FILE` dan bertahan setelah restart; 57 tes lulus (33 lama +
  24 baru), build dan tipe lolos

**Berikutnya:** uji manual tahap 7 — trigger n8n mendaftar sendiri waktu
workflow diaktifkan. Butuh perubahan di sisi node (`../n8n-nc-wa`), yaitu
`webhookMethods` pada trigger, yang akan jadi rilis `0.3.0`.
