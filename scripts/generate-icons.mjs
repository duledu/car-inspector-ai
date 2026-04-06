// =============================================================================
// Icon Generator — creates public/icons/*.png using only Node built-ins
// Run: node scripts/generate-icons.mjs
// =============================================================================

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

// ─── CRC32 (required by PNG spec) ────────────────────────────────────────────
function makeCRCTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c
  }
  return table
}
const CRC_TABLE = makeCRCTable()
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF]
  return ((crc ^ 0xFFFFFFFF) >>> 0)
}

// ─── PNG chunk helper ─────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([len, t, d, crcBuf])
}

// ─── Icon design: dark bg + cyan gradient ring + white centre ─────────────────
function makePNG(size) {
  const cx = size / 2, cy = size / 2
  const outerR = size * 0.42
  const innerR = size * 0.24
  const rows = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0 // filter type: None
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      let r, g, b
      if (dist < innerR) {
        // Bright centre — magnifier / search dot
        r = 240; g = 252; b = 255
      } else if (dist < outerR) {
        // Cyan → indigo gradient ring
        const t = (dist - innerR) / (outerR - innerR)
        r = Math.round(34  + t * (129 - 34))
        g = Math.round(211 + t * (140 - 211))
        b = Math.round(238 + t * (248 - 238))
      } else {
        // Dark background matching app (#080c14)
        r = 8; g = 12; b = 20
      }
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }

  const raw = Buffer.concat(rows)
  const compressed = deflateSync(raw, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  // [10]=compression [11]=filter [12]=interlace all 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Generate ─────────────────────────────────────────────────────────────────
mkdirSync('public/icons', { recursive: true })

const icons = [
  ['icon-192.png',        192],
  ['icon-512.png',        512],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of icons) {
  const buf = makePNG(size)
  writeFileSync(`public/icons/${name}`, buf)
  console.log(`✓ public/icons/${name}  (${size}×${size}, ${buf.length} bytes)`)
}

console.log('\nAll icons generated successfully.')
