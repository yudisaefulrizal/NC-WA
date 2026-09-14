// Penerima webhook untuk uji manual. Mencetak payload apa adanya.
// Jalankan: node scripts/webhook-listener.mjs [port]
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4000)

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end()
    return
  }

  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    const waktu = new Date().toISOString()
    let isi
    try {
      isi = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      isi = body
    }
    console.log(`\n=== ${waktu} ===\n${isi}`)
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
  })
}).listen(port, '127.0.0.1', () => {
  console.log(`Penerima webhook siap di http://127.0.0.1:${port}`)
  console.log('Isi .env: WEBHOOK_URL=http://127.0.0.1:' + port)
})
