// Lists boxes (a background, bigger than a button) that sit inside another such box - with a wallpaper on.
const { api, openApp } = require('./lib.cjs')
const FIND = () => {
  const bgOf = (e) => {
    const s = getComputedStyle(e)
    const bg = s.backgroundColor
    const a = bg === 'transparent' ? 0 : bg.includes('/') ? parseFloat(bg.split('/')[1]) : (bg.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1)
    return Number(a) >= 0.3 || s.backgroundImage !== 'none'
  }
  const isBox = (e) => {
    if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'AUDIO', 'VIDEO', 'svg', 'HTML', 'BODY'].includes(e.tagName)) return false
    if (e.closest('button, header.app-header, nav')) return false
    const r = e.getBoundingClientRect()
    return r.width > 160 && r.height > 50 && bgOf(e)
  }
  const name = (e) => e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : '')
  const out = []
  for (const e of document.querySelectorAll('body *')) {
    if (!isBox(e)) continue
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (isBox(p)) { out.push(`${name(p)}  >>  ${name(e)}`); break }
    }
  }
  return out
}
;(async () => {
  const { call } = await api()
  const before = (await call('GET', '/settings/appearance')).data
  const feed = (await call('GET', '/feed?take=50')).data
  const pages = ['/feed', '/today', '/calendar', '/settings']
  for (const [k, base] of [['Task', 'tasks'], ['Appointment', 'appointments'], ['Note', 'notes']]) {
    const it = feed.items.find((i) => i.kind === k)
    if (it) pages.push(`/${base}/${it.id}`, `/${base}/${it.id}?edit=1`)
  }
  const found = new Map()
  await call('PUT', '/settings/appearance', { ...before, theme: 'Light', wallpaper: true })
  try {
    for (const width of [420, 1280]) {
      const { browser, page } = await openApp({ width, height: 1000 })
      try {
        for (const p of pages) {
          await page.goto('http://localhost:5173' + p); await page.waitForTimeout(1500)
          for (const f of await page.evaluate(FIND)) if (!found.has(f)) found.set(f, `${p} ${width}`)
        }
      } finally { await browser.close() }
    }
  } finally { await call('PUT', '/settings/appearance', before) }
  for (const [f, w] of found) console.log(f.padEnd(110), w)
})()
