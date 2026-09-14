# Uji Manual

Yang tersisa dari [ROADMAP.md](ROADMAP.md) — semuanya butuh HP asli.
Jalankan berurutan, centang yang lulus.

## Siapkan

Ganti `<KEY>` dengan `API_KEY` dari `.env`, `<TUJUAN>` dengan nomor
HP-mu sendiri, `<GRUP>` dengan id grup uji.

```bash
export KEY=<KEY>
export WA=http://127.0.0.1:8066
export TUJUAN=628xxxxxxxxxx
```

Jalankan engine di satu terminal:
```bash
npm run dev
```

---

## 1. Media (tahap 2)

```bash
# gambar + caption
curl -s -X POST $WA/sessions/toko-a/messages/media \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d "{\"to\":\"$TUJUAN\",\"type\":\"image\",\"url\":\"https://picsum.photos/600/400\",\"caption\":\"uji gambar\"}"

# dokumen
curl -s -X POST $WA/sessions/toko-a/messages/media \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d "{\"to\":\"$TUJUAN\",\"type\":\"document\",\"url\":\"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf\",\"filename\":\"uji.pdf\"}"
```

- [ ] Gambar sampai, caption terbaca
- [ ] Dokumen sampai, bisa dibuka, namanya `uji.pdf`

## 2. Grup (tahap 2)

Ambil id grup: kirim pesan apa saja ke grup dari HP, lihat `groupId`
di webhook (langkah 3), atau pakai id yang sudah kamu tahu.

```bash
curl -s -X POST $WA/sessions/toko-a/messages/text \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d '{"to":"<GRUP>","text":"uji kirim grup"}'
```

- [ ] Pesan muncul di grup

## 3. Webhook (tahap 3)

Terminal kedua:
```bash
node scripts/webhook-listener.mjs
```

Tambahkan ke `.env` lalu restart engine:
```
WEBHOOK_URL=http://127.0.0.1:4000
BASE_URL=http://127.0.0.1:8066
```

Kirim dari HP ke nomor engine:

- [ ] Kirim teks → payload muncul di listener
- [ ] Kirim gambar → `media.url` ada; unduh dengan:
      `curl -sI -H "X-API-Key: $KEY" "<media.url>"` → 200
- [ ] Kirim dari grup → `isGroup: true`, `groupId` terisi,
      `sender` = nomor pengirim (bukan id grup)
- [ ] Isi pesan **tidak** muncul di log engine (terminal pertama)

Uji filter:
```bash
curl -s -X PUT $WA/sessions/toko-a/filter \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d '{"filter":"private"}'
```
- [ ] Pesan grup berhenti diteruskan, pesan pribadi tetap masuk
- [ ] Kembalikan ke `all` setelah selesai

## 4. Presence (tahap 4)

Kirim pesan dari HP ke engine, ambil `messageId` dari webhook, lalu:

```bash
# tandai dibaca
curl -s -X POST $WA/sessions/toko-a/read \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d "{\"from\":\"$TUJUAN\",\"messageId\":\"<ID>\"}"

# sedang mengetik
curl -s -X POST $WA/sessions/toko-a/typing \
  -H "X-API-Key: $KEY" -H 'content-type: application/json' \
  -d "{\"to\":\"$TUJUAN\",\"state\":\"composing\"}"
```

- [ ] Centang biru muncul di HP pengirim
- [ ] Indikator "sedang mengetik" terlihat di HP (beberapa detik)

## 5. Jaringan & device (tahap 1, sisa)

- [ ] Matikan wifi/data server → nyalakan lagi → reconnect sendiri,
      status kembali `connected` tanpa scan ulang
- [ ] Hapus device dari HP (WhatsApp → Perangkat tertaut) →
      status jadi `logged_out`, log tidak loop reconnect

## 6. Dashboard (tahap 5)

Buka `http://127.0.0.1:8066` di browser.

- [ ] Masukkan API key → daftar session muncul
- [ ] Pasang nomor baru dari awal sampai `connected` lewat UI
- [ ] Ubah filter lewat UI → berubah di `GET /sessions/toko-a`
- [ ] Statistik tampil wajar

## 7. Instalasi bersih (tahap 6)

Di server lain atau folder baru, ikuti README apa adanya.

- [ ] Jalan sampai bisa scan QR tanpa perlu menebak langkah
