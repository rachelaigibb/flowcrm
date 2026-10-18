// Export the approved artwork; retain the master without redrawing the mark.
const sharp = require('sharp')
const fs = require('node:fs/promises')
const source = 'assets/branding/flowcrm-icon-master.png'
async function main() {
  for (const size of [192, 512]) {
    await sharp(source).resize(size, size).png().toFile(`public/icon-${size}.png`)
    // Keep the full mark inside Android's central 80%-diameter safe circle.
    const inner = Math.round(size * 0.8)
    const mark = await sharp(source).resize(inner, inner).png().toBuffer()
    await sharp({create: {width: size, height: size, channels: 3, background: '#000000'}})
      .composite([{input: mark, gravity: 'centre'}]).png().toFile(`public/icon-maskable-${size}.png`)
  }
  await sharp(source).resize(512, 512).png().toFile('src/app/icon.png')
  await sharp(source).resize(180, 180).png().toFile('src/app/apple-icon.png')
  // ICO supports PNG entries; provide native browser sizes without dependencies.
  const sizes = [16, 32, 48]
  const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()))
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  images.forEach((data, i) => {
    const pos = 6 + i * 16
    header[pos] = header[pos + 1] = sizes[i]
    header.writeUInt16LE(1, pos + 4)
    header.writeUInt16LE(32, pos + 6)
    header.writeUInt32LE(data.length, pos + 8)
    header.writeUInt32LE(offset, pos + 12)
    offset += data.length
  })
  await fs.writeFile('src/app/favicon.ico', Buffer.concat([header, ...images]))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
