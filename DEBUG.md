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
