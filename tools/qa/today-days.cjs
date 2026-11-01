// Today page: other days by swiping, ‹ › or ← → (2026-11-01). Seeded QA account (node seed.cjs). No AI calls.
const { openApp } = require('./lib.cjs')
const check = (n, ok, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  -- ' + d : ''}`)
;(async () => {
  const { browser, page, errors, shot } = await openApp({ width: 420, height: 900 })
  try {
    await page.goto('http://localhost:5173/today'); await page.waitForSelector('.sections')
    const h1 = () => page.locator('.page-header h1').textContent()
    const sections = () => page.locator('.sections .section h2').allTextContents()
    const today = await h1()
    check('today: ongoing and overdue are there', (await sections()).some((s) => s.startsWith('Ongoing')) && (await sections()).some((s) => s.startsWith('Overdue')), (await sections()).join(' | '))
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(800)
    const tomorrow = await h1()
    check('→: the next day', tomorrow !== today, `${today} -> ${tomorrow}`)
    const s2 = await sections()
    check('another day: no overdue / ongoing, "Due"', !s2.some((s) => /^(Overdue|Ongoing)/.test(s)) && s2.some((s) => /^Due(?! today)/.test(s)), s2.join(' | '))
    check('...a "Today" button to come back', (await page.getByRole('main').getByRole('button', { name: 'Today', exact: true }).count()) === 1)
    await shot('today-other-day')
    const swipe = (from, to) => page.evaluate(([a, b]) => {
      const el = document.querySelector('.day-swipe')
      const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 500 })
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(a)], changedTouches: [touch(a)] }))
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(b)] }))
    }, [from, to])
    await swipe(350, 80); await page.waitForTimeout(800)
    check('swipe left: one more day', (await h1()) !== tomorrow)
    await swipe(80, 350); await page.waitForTimeout(800)
    check('swipe right: back a day', (await h1()) === tomorrow)
    await page.getByRole('main').getByRole('button', { name: 'Today', exact: true }).click(); await page.waitForTimeout(800)
    check('Today button: back to today, button gone', (await h1()).startsWith(today.slice(0, 10)) && (await page.getByRole('main').getByRole('button', { name: 'Today', exact: true }).count()) === 0)
    await page.locator('.page-header button', { hasText: '‹' }).click(); await page.waitForTimeout(800)
    check('‹: yesterday', (await h1()) !== today)
    await page.getByRole('main').getByRole('button', { name: 'Today', exact: true }).click(); await page.waitForTimeout(800)
    // An event a few days ahead with a reminder: on its day, its reminder is listed.
    const { api } = require('./lib.cjs')
    const { call } = await api()
    const at = new Date(Date.now() + 3 * 86400e3)
    const ev = (await call('POST', '/appointments', { title: 'Reminder day check', startUtc: at.toISOString(), endUtc: new Date(at.getTime() + 3600e3).toISOString(), reminders: [{ kind: 'Before', minutesBefore: 30 }] })).data
    for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight')
    let found = false
    for (let i = 0; i < 2 && !found; i++) {
      await page.waitForTimeout(800)
      const box = page.locator('.sections .section', { has: page.locator('h2', { hasText: /^Reminders/ }) })
      found = (await box.count()) === 1 && /Reminder day check/.test(await box.textContent())
      if (!found) await page.keyboard.press('ArrowRight')
    }
    check("another day lists the reminders going off that day", found, (await sections()).join(' | '))
    await call('POST', '/items/delete', { items: [{ itemType: 'Appointment', id: ev.id }] })
    console.log('page errors:', errors.filter((e) => !/401/.test(e)))
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  } finally {
    await browser.close()
  }
})()
