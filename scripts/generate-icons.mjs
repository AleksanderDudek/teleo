// Rasterizes the Teleo mark into the PNG icons referenced by the web manifest.
// Run once after changing public/icons/teleo-mark.svg: `npm run icons` (outputs are committed).
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

const OUT = new URL('../public/icons/', import.meta.url)
const master = await readFile(new URL('teleo-mark.svg', OUT))

/** Regular icons get rounded corners; maskable/Apple icons must be full-bleed squares. */
function rounded(size) {
  const r = Math.round(size * 0.22)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`,
  )
}

async function render(file, size, { mask = false, scale = 1 } = {}) {
  const inner = Math.round(size * scale)
  let image = sharp(master, { density: 384 }).resize(inner, inner)
  if (scale !== 1) {
    const pad = Math.round((size - inner) / 2)
    image = sharp(await image.png().toBuffer()).extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: '#1f4a3a',
    })
  }
  let buffer = await image.png().toBuffer()
  if (mask) buffer = await sharp(buffer).composite([{ input: rounded(size), blend: 'dest-in' }]).png().toBuffer()
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(new URL(file, OUT).pathname)
  console.log('wrote', file)
}

await render('pwa-64x64.png', 64, { mask: true })
await render('pwa-192x192.png', 192, { mask: true })
await render('pwa-512x512.png', 512, { mask: true })
// Maskable: content already sits inside the 80% safe zone; keep full bleed.
await render('maskable-icon-512x512.png', 512)
await render('apple-touch-icon-180x180.png', 180)
