// Run: node tools/qa/icons.cjs (from the repo root; uses the QA tools' playwright-core).
// Renders the web app's PNG icons from the SVGs (headless Chrome).
const fs = require('fs')
const path = require('path')
;(async () => {
  const { chromium } = require('playwright-core')
  const pub = 'C:/Projects/aiPlanner/web/public'
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const [src, out, size] of [
    ['icon.svg', 'icon-192.png', 192],
    ['icon.svg', 'icon-512.png', 512],
    ['icon-maskable.svg', 'icon-maskable-512.png', 512],
    ['icon-maskable.svg', 'apple-touch-icon.png', 180],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const svg = fs.readFileSync(path.join(pub, src), 'utf8')
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: path.join(pub, out), omitBackground: true })
    await page.close()
    console.log('wrote', out)
  }
  await browser.close()
})()
