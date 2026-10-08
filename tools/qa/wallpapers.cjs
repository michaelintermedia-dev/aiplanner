// Renders each skin's wallpaper (shared/appearance.ts wallpaperCss) to an image for the
// phone app: mobile/assets/wallpapers/<skin>-<light|dark>.jpg. Run after changing a skin:
//   web/node_modules/.bin/tsc shared/appearance.ts --outDir tools/qa/out/shared-cjs --module commonjs --target es2022 --skipLibCheck --moduleResolution node10 --ignoreDeprecations 6.0
//   node tools/qa/wallpapers.cjs
const path = require('path')
const { chromium } = require('playwright-core')
const { SKIN_NAMES, wallpaperCss } = require('./out/shared-cjs/appearance.js')
const OUT = path.join(__dirname, '..', '..', 'mobile', 'assets', 'wallpapers')
;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 540, height: 1170 } })
  for (const skin of SKIN_NAMES) {
    for (const scheme of ['light', 'dark']) {
      await page.setContent(`<html><body style="margin:0;width:540px;height:1170px;background:${wallpaperCss(scheme, skin)}"></body></html>`)
      await page.screenshot({ path: path.join(OUT, `${skin.toLowerCase()}-${scheme}.jpg`), type: 'jpeg', quality: 85 })
    }
  }
  await browser.close()
})()
