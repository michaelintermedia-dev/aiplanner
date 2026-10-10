// Every text on a wallpaper must have something behind it: finds text (and icons) whose
// ancestors up to <body> have no background, on every page, phone and desktop, light and dark.
const { api, openApp } = require('./lib.cjs')

const FIND = () => {
  const out = []
  const backed = (el) => {
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      const bg = s.backgroundColor
      const alpha = bg === 'transparent' ? 0 : bg.includes('/') ? parseFloat(bg.split('/')[1]) : (bg.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1)
      if (Number(alpha) >= 0.5 || s.backgroundImage !== 'none') return true
    }
    return false
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.1) return false
    }
    return true
  }
  const name = (el) => {
    const parts = []
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : ''))
    }
    return parts.join(' > ')
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement
    if (!n.textContent.trim() || seen.has(el) || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName)) continue
    seen.add(el)
    if (visible(el) && !backed(el)) out.push(`text  ${name(el)}  "${n.textContent.trim().slice(0, 40)}"`)
  }
  for (const svg of document.querySelectorAll('svg')) {
    if (visible(svg) && !backed(svg)) out.push(`icon  ${name(svg.parentElement)}`)
  }
  return out
}

;(async () => {
  const { call } = await api()
  const before = (await call('GET', '/settings/appearance')).data
  const feed = (await call('GET', '/feed?take=50')).data
  const firstOf = (k) => feed.items.find((i) => i.kind === k)
  const pages = ['/feed', '/feed?show=tasks', '/feed?show=events', '/feed?show=notes', '/today', '/calendar', '/settings']
  for (const [k, base] of [['Task', 'tasks'], ['Appointment', 'appointments'], ['Note', 'notes']]) {
    const it = firstOf(k)
    if (it) pages.push(`/${base}/${it.id}`, `/${base}/${it.id}?edit=1`)
  }
  const found = new Map()
  try {
    for (const theme of ['Light', 'Dark']) {
      await call('PUT', '/settings/appearance', { ...before, theme, wallpaper: true, wallpaperPhoto: undefined })
      for (const width of [420, 1280]) {
        const { browser, page } = await openApp({ width, height: 1000 })
        try {
          const visit = async (label) => {
            await page.waitForTimeout(1500)
            for (const f of await page.evaluate(FIND)) {
              const key = f.replace(/".*"$/, '')
              if (!found.has(key)) found.set(key, `${f}   [${label} ${width}px ${theme}]`)
            }
          }
          for (const p of pages) {
            await page.goto('http://localhost:5173' + p)
            await visit(p)
            if (p === '/calendar') {
              for (const v of ['Week', 'Month']) {
                await page.getByRole('button', { name: v, exact: true }).first().click().catch(() => {})
                await visit(`/calendar ${v}`)
              }
            }
            if (p === '/feed') {
              await page.getByRole('button', { name: /filter/i }).first().click().catch(() => {})
              await visit('/feed filters')
              await page.keyboard.press('Escape')
              if (width === 420) {
                await page.locator('.capture-dock-bubble, .dock-bubble').first().click().catch(() => {})
                await visit('/feed dock open')
              }
            }
          }
          // Signed out: the sign-in page keeps the last wallpaper.
          await page.evaluate(() => Object.keys(localStorage).filter((k) => /refresh/i.test(k)).forEach((k) => localStorage.removeItem(k)))
          await page.goto('http://localhost:5173/')
          await visit('sign-in')
        } finally {
          await browser.close()
        }
      }
    }
  } finally {
    await call('PUT', '/settings/appearance', before)
  }
  console.log([...found.values()].sort().join('\n') || 'nothing found')
})().catch((e) => { console.error(e); process.exit(1) })
