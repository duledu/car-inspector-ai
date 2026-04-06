// =============================================================================
// Icon Generator — renders app-icon.svg → PNG at all required sizes
// Run: node scripts/generate-icons.mjs
// Requires: @resvg/resvg-js (npm i -D @resvg/resvg-js)
// =============================================================================

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = join(__dirname, '..')
const svgPath   = join(root, 'public', 'icons', 'app-icon.svg')
const outDir    = join(root, 'public', 'icons')

mkdirSync(outDir, { recursive: true })

const svgData = readFileSync(svgPath, 'utf8')

const sizes = [
  { name: 'app-icon.png',          size: 512 },
  { name: 'icon-512.png',          size: 512 },
  { name: 'icon-192.png',          size: 192 },
  { name: 'apple-touch-icon.png',  size: 180 },
]

for (const { name, size } of sizes) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
    font:  { loadSystemFonts: false },
  })

  const png = resvg.render().asPng()
  writeFileSync(join(outDir, name), png)
  console.log(`✓ ${name}  (${size}×${size}, ${png.length} bytes)`)
}

console.log('\nAll icons generated from app-icon.svg')
