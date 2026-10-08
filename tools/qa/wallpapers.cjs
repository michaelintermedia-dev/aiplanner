// Renders each skin's wallpaper (WhatsApp-like: big organic shapes in muted tones that
// overlap - darker where they do - on a paper grain) from shared/appearance.ts's colours:
//   mobile/assets/wallpapers/<skin>-<light|dark>.jpg       (portrait - the app)
//   web/public/wallpapers/<skin>-<light|dark>[-wide].jpg  (portrait and wide - the web)
// Run after changing a skin's wallpaper colours:
//   web/node_modules/.bin/tsc shared/appearance.ts --outDir tools/qa/out/shared-cjs --module commonjs --target es2022 --skipLibCheck --moduleResolution node10 --ignoreDeprecations 6.0
//   node tools/qa/wallpapers.cjs
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const { SKIN_NAMES, SKINS, wallpaperFile } = require('./out/shared-cjs/appearance.js')

const ROOT = path.join(__dirname, '..', '..')
const MOBILE = path.join(ROOT, 'mobile', 'assets', 'wallpapers')
const WEB = path.join(ROOT, 'web', 'public', 'wallpapers')

// Shapes in 0..1 coordinates (x right, y down), drawn in this order: the corner
// sliver over the top-left lobe, the tall middle shape, the bottom one over it.
const SHAPES = {
  portrait: [
    { color: 0, points: [[-0.15, -0.05], [0.72, -0.05], [0.68, 0.12], [0.52, 0.27], [0.33, 0.33], [0.12, 0.27], [-0.15, 0.13]] },
    { color: 3, points: [[0.56, -0.05], [1.05, -0.05], [0.93, 0.07], [0.76, 0.22], [0.56, 0.34], [0.41, 0.36], [0.39, 0.27], [0.48, 0.12]] },
    { color: 1, points: [[1.1, 0.02], [1.1, 0.6], [0.8, 0.66], [0.45, 0.66], [0.27, 0.57], [0.25, 0.43], [0.33, 0.31], [0.58, 0.2], [0.86, 0.06]] },
    { color: 2, points: [[-0.15, 0.57], [0.24, 0.5], [0.46, 0.51], [0.66, 0.58], [0.71, 0.75], [0.68, 0.92], [0.63, 1.08], [-0.15, 1.08]] },
  ],
  wide: [
    { color: 0, points: [[-0.05, -0.1], [0.42, -0.1], [0.4, 0.2], [0.3, 0.48], [0.17, 0.58], [0.05, 0.5], [-0.05, 0.3]] },
    { color: 3, points: [[0.3, -0.1], [0.62, -0.1], [0.56, 0.12], [0.46, 0.38], [0.34, 0.6], [0.24, 0.62], [0.24, 0.45], [0.28, 0.2]] },
    { color: 1, points: [[1.05, -0.1], [1.05, 0.85], [0.85, 0.95], [0.62, 0.92], [0.5, 0.75], [0.5, 0.45], [0.58, 0.2], [0.75, 0.0]] },
    { color: 2, points: [[-0.05, 0.62], [0.18, 0.52], [0.36, 0.55], [0.54, 0.68], [0.6, 0.9], [0.58, 1.1], [-0.05, 1.1]] },
  ],
}

/** A smooth closed curve through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(points, w, h) {
  const p = points.map(([x, y]) => [x * w, y * h])
  const n = p.length
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1.map((v) => v.toFixed(1)).join(',')} ${c2.map((v) => v.toFixed(1)).join(',')} ${p2.map((v) => v.toFixed(1)).join(',')}`
  }
  return d + ' Z'
}

function svg(wallpaper, scheme, layout, w, h) {
  const shapes = SHAPES[layout]
    .map((s) => `<path d="${smoothPath(s.points, w, h)}" fill="${wallpaper.shapes[s.color]}" style="mix-blend-mode:multiply" opacity="0.92"/>`)
    .join('')
  // Paper grain: fine noise, a touch stronger on dark wallpapers (they'd look flat otherwise).
  const grain = scheme === 'dark' ? 0.1 : 0.12
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 ${grain} 0"/></filter>
  <filter id="soft"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="7"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0"/></filter>
  <rect width="100%" height="100%" fill="${wallpaper.bg}"/>
  <g style="isolation:isolate">${shapes}</g>
  <rect width="100%" height="100%" filter="url(#soft)"/>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>`
}

;(async () => {
  fs.mkdirSync(MOBILE, { recursive: true })
  fs.mkdirSync(WEB, { recursive: true })
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage()
  const render = async (wallpaper, scheme, layout, w, h, files) => {
    await page.setViewportSize({ width: w, height: h })
    await page.setContent(`<html><body style="margin:0">${svg(wallpaper, scheme, layout, w, h)}</body></html>`)
    for (const file of files) await page.screenshot({ path: file, type: 'jpeg', quality: 80 })
  }
  for (const skin of SKIN_NAMES) {
    for (const scheme of ['light', 'dark']) {
      const wallpaper = SKINS[skin][scheme].wallpaper
      await render(wallpaper, scheme, 'portrait', 720, 1560, [path.join(MOBILE, wallpaperFile(skin, scheme)), path.join(WEB, wallpaperFile(skin, scheme))])
      await render(wallpaper, scheme, 'wide', 1920, 1080, [path.join(WEB, wallpaperFile(skin, scheme, true))])
    }
  }
  await browser.close()
})()
