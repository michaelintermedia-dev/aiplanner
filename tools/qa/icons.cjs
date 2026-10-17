// Run: node tools/qa/icons.cjs (from the repo root; uses the QA tools' playwright-core).
// Renders every icon from the SVGs (headless Chrome). The Gatazee cat itself is drawn once, in
// mobile/assets/icon-src/cat.svg; web/public/icon.svg, favicon.svg and icon-maskable.svg are that
// cat on the Indigo tile (rounded / full-bleed). Change the cat there, copy it into the web SVGs,
// then re-run this.
const fs = require('fs')
const path = require('path')
const ROOT = 'C:/Projects/aiPlanner'
const pub = `${ROOT}/web/public`
const src = `${ROOT}/mobile/assets/icon-src`
const img = `${ROOT}/mobile/assets/images`

const read = (file) => fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '')
/** The drawing inside an SVG file, scaled about the centre (Android keeps adaptive icons' middle ~60%). */
const scaled = (file, scale) => {
  const inner = read(file).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`
}

const jobs = [
  // Web: favicon, PWA icons, iPhone home screen.
  [read(`${pub}/icon.svg`), `${pub}/icon-192.png`, 192],
  [read(`${pub}/icon.svg`), `${pub}/icon-512.png`, 512],
  [read(`${pub}/icon-maskable.svg`), `${pub}/icon-maskable-512.png`, 512],
  [read(`${pub}/icon-maskable.svg`), `${pub}/apple-touch-icon.png`, 180],
  // Phone app: the store/legacy icon (square - the system rounds it), Android's adaptive icon
  // in layers, its themed (monochrome) version, the splash cat and the web build's favicon.
  [read(`${pub}/icon-maskable.svg`), `${img}/icon.png`, 1024],
  [scaled(`${src}/cat.svg`, 0.6), `${img}/android-icon-foreground.png`, 1024],
  [read(`${src}/background.svg`), `${img}/android-icon-background.png`, 1024],
  [scaled(`${src}/cat-mono.svg`, 0.6), `${img}/android-icon-monochrome.png`, 1024],
  [read(`${src}/cat.svg`), `${img}/splash-icon.png`, 512],
  [read(`${pub}/icon.svg`), `${img}/favicon.png`, 48],
]

;(async () => {
  const { chromium } = require('playwright-core')
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const [svg, out, size] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: out, omitBackground: true })
    await page.close()
    console.log('wrote', path.relative(ROOT, out), size)
  }
  await browser.close()
})()
