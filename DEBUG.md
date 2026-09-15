# Catatan Kegagalan

Isinya bukan daftar tugas, tapi hal yang **sudah terbukti tidak berhasil** —
supaya tidak diulang. Ditulis tiap kali satu percobaan perbaikan gagal.

Format per masalah:

```
## <gejalanya, bukan dugaan penyebabnya>
- Coba 1: <apa yang diubah> → <hasilnya>
- Coba 2: <apa yang diubah> → <hasilnya>
- Terbukti bukan penyebabnya: <yang sudah dicek dan bersih>
- Status: belum selesai / selesai — <sebabnya apa>
```

Baris "terbukti bukan penyebabnya" yang paling penting. Itu yang paling
sering hilang dari ingatan dan paling mahal diulang.

Masalah yang sudah selesai tetap disimpan, jangan dihapus — kalau gejala
yang sama muncul lagi, catatannya sudah ada.

---

<!-- belum ada. isi waktu ada percobaan perbaikan yang gagal. -->

## Reconnect terus dijadwalkan tetapi tidak membuka socket baru
- Coba 1: menunggu `session.opening` sebelum setiap retry → setelah satu
  pembukaan socket ditolak, retry berikutnya kembali menerima rejection
  yang sama; tes regresi hanya mencatat 2 pembukaan, seharusnya 3.
- Terbukti bukan penyebabnya: timer/backoff berjalan dan callback putus
  terpanggil; kegagalan direproduksi dengan socket tiruan tanpa jaringan.
- Coba 2: tangani rejection lama sebelum retry/cleanup → tes regresi
  berhasil membuka socket ketiga dan kembali connected.
- Status: selesai — promise pembukaan gagal tidak lagi menghalangi retry.

## Perintah lokal tertolak oleh sandbox
- Instal npm gagal `EAI_AGAIN`; tsx gagal membuat socket IPC (`EPERM`);
  Git gagal menulis `.git/index.lock` karena read-only.
- Terbukti bukan penyebabnya: dependensi terpasang, tes lolos, dan commit
  berhasil setelah perintah dijalankan dengan izin yang sesuai.
- Status: selesai — pembatasan lingkungan, bukan kesalahan aplikasi.

## Logger Baileys tidak menutup log kredensial dari libsignal
- Coba 1: logger silent pada socket Baileys → audit dependensi menunjukkan
  libsignal masih memanggil console.info/warn dengan objek session lengkap.
- Terbukti bukan penyebabnya: log aplikasi tidak menerima body pesan;
  sumbernya console langsung di libsignal/src/session_record.js.
- Status: diperbaiki dengan menonaktifkan info/warn library dan mengganti
  error library dengan ringkasan tanpa objek; log aplikasi memakai console.log.

## Pesan masuk diterima engine tapi tidak sampai ke webhook
- Gejala: `stats.received` bertambah, filter `all`, tapi listener webhook
  tidak menerima event `message` sama sekali.
- Terbukti bukan penyebabnya: filter session (`all`), listener (uji POST
  langsung dibalas 200), dan isi `.env` (WEBHOOK_URL sudah terisi).
- Sebab: dua engine jalan bersamaan. Proses `npm start` lama memegang
  port 8066 dan session, dijalankan sebelum WEBHOOK_URL ditambahkan;
  `npm run dev` yang baru gagal mengikat port tapi tidak memberi pesan
  apa pun sehingga terlihat seperti jalan normal.
- Status: selesai — proses lama dimatikan.
- Menyusul: engine sebaiknya berhenti dengan pesan jelas kalau port
  sudah dipakai, bukan diam. Lihat catatan di ROADMAP tahap 6.

## Perubahan kode tidak berlaku setelah `git pull` dan `npm run build` di server

- Coba 1: `git pull` sebagai root → ditolak `dubious ownership` karena
  folder milik `www`. Yang menyesatkan: `npm install` dan `npm run build`
  setelahnya tetap jalan dan terlihat sukses, padahal yang dibangun masih
  kode lama. Perbaikannya
  `git config --global --add safe.directory /www/wwwroot/NC-WA`.
- Coba 2: pull berhasil dan build lulus, tapi endpoint baru tetap
  `not_found` → proses lama masih memegang kode lama di memori.
- Terbukti bukan penyebabnya: `.env`, hasil build, dan kepemilikan berkas
  semuanya benar; engine menjawab `not_found` (bukan menolak koneksi),
  jadi ia hidup dan API key-nya sah.
- Status: selesai — engine harus dijalankan ulang, bukan sekadar
  dibangun. Tombol restart aaPanel tidak menghentikan prosesnya; PID-nya
  tidak berubah. Yang berhasil: `kill <pid>` lalu nyalakan lagi dari
  panel.

  Sesudah `kill`, panel **tidak** menghidupkannya sendiri. Jangan tinggalkan
  engine mati — nyalakan lagi lewat panel supaya tetap dikelola panel dan
  ikut hidup waktu server reboot. Menjalankan lewat `nohup` manual memang
  bisa, tapi hilang setelah reboot.
