import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC  = join(__dirname, '..', 'public', 'brand', 'fenster-logo.png')
const OUT  = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// Trim transparent padding from logo first, then resize by WIDTH.
// Logo is a wide wordmark (~5.6:1 ratio after trim) — we fill icon WIDTH
// so the brand name is as large as possible on the white square.
async function getTrimmedLogo() {
  return sharp(SRC).trim().toBuffer()
}

async function makeIcon(size, logoWidthFraction, outName) {
  const trimmed = await getTrimmedLogo()
  const tMeta   = await sharp(trimmed).metadata()
  const logoW   = Math.round(size * logoWidthFraction)
  const logoH   = Math.round(logoW * (tMeta.height / tMeta.width))
  const left    = Math.round((size - logoW) / 2)
  const top     = Math.round((size - logoH) / 2)

  // Resize to target width; flatten alpha → white so the brand colours show clearly
  const resized = await sharp(trimmed)
    .resize(logoW, logoH, { fit: 'fill' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()

  // White canvas + logo
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, outName))

  console.log(`✓ ${outName}  (${size}×${size}, logo ${logoW}×${logoH}px, centred at top=${top})`)
}

// Standard icons: 88% width fill, white background
await makeIcon(192, 0.88, 'icon-192x192.png')
await makeIcon(512, 0.88, 'icon-512x512.png')

// Maskable: logo must stay inside the inner 80% Android safe zone.
// 88% × 80% = 70.4% of the 512px canvas so the logo survives any mask crop.
await makeIcon(512, 0.704, 'maskable-icon-512x512.png')

console.log('\n✓ All icons generated — white background, logo maximised.')
