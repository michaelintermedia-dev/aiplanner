// Spec v2 (2026-10-31), steps 3-7: bottom navigation, the chip row + ⚙ sheet, the Smart order
// with sections, triage rows and the search box's mic. Run on a freshly seeded QA account
// (node seed.cjs). One AI call (the mic's transcription).
const { api, openApp, OUT } = require('./lib.cjs')
const path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const ORDER = ['Overdue', 'Today', 'Upcoming', 'NoDate', 'Notes', 'Done']

;(async () => {
  const { call } = await api()

  // ---- the API ----
  const smart = (await call('GET', '/feed?sort=Smart&take=100')).data
  const sections = smart.items.map((i) => i.section)
  check('Smart: every item has a section, in order', sections.every((s, i) => i === 0 || ORDER.indexOf(sections[i - 1]) <= ORDER.indexOf(s)), sections.join(','))
  const where = (title) => smart.items.find((i) => i.title === title)?.section
  check('overdue task -> Overdue', where('Overdue report') === 'Overdue', where('Overdue report'))
  check('done task and passed event -> Done', where('Already done') === 'Done' && where('Last week workshop') === 'Done')
  check('undated open task -> No date', where('Learn Hebrew alphabet') === 'NoDate', where('Learn Hebrew alphabet'))
  check('notes -> Notes', where('Gift ideas') === 'Notes')
  check('section counts come with the page', smart.sections?.Done === 2 && smart.sections?.Notes === 3, JSON.stringify(smart.sections))
  const paged = []
  let cursor = null
  do {
    const p = (await call('GET', `/feed?sort=Smart&take=4${cursor ? `&cursor=${cursor}` : ''}`)).data
    paged.push(...p.items.map((i) => i.id))
    cursor = p.nextCursor
  } while (cursor)
  check('paging in Smart order: same order, nothing twice', paged.join() === smart.items.map((i) => i.id).join())

  const tz = (await call('GET', '/users/me')).data.timeZoneId
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayKey = fmt.format(new Date())
  // Midnight there, roughly (the QA account's zone has no DST jump today).
  const offset = (d) => {
    const local = new Date(d.toLocaleString('en-US', { timeZone: tz }))
    return d.getTime() - local.getTime()
  }
  const start = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() + offset(new Date()))
  const end = new Date(start.getTime() + 86400e3)
  const today = (await call('GET', `/feed?sort=Smart&take=100&dateFrom=${start.toISOString()}&dateTo=${end.toISOString()}&withOverdue=true`)).data.items.map((i) => i.title)
  check('Today chip: today + overdue tasks', today.includes('Overdue report') && today.includes('Call the bank') && !today.includes('Dentist') && !today.includes('Gift ideas'), today.join(', '))
  const open = (await call('GET', '/feed?take=100&status=Open')).data.items
  check('Open includes notes, not done ones', open.some((i) => i.kind === 'Note') && !open.some((i) => i.title === 'Already done'))
  check('With media: none seeded', (await call('GET', '/feed?take=100&hasMedia=true')).data.items.length === 0)

  // The search box's mic: words only.
  const fs = require('fs')
  const wav = path.join(OUT, 'hold.wav')
  if (fs.existsSync(wav)) {
    const form = new FormData()
    form.append('audio', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), 'search.wav')
    const r = await call('POST', '/transcribe', form)
    check('POST /transcribe returns the words', r.status === 200 && r.data?.text?.length > 0, JSON.stringify(r.data))
  } else console.log('SKIP  /transcribe (no out/hold.wav)')

  // ---- the web app, phone width ----
  const { browser, page, errors, shot } = await openApp({ width: 420, height: 900 })
  try {
    await page.goto('http://localhost:5173/feed')
    await page.waitForSelector('.feed-row')
    const tabs = await page.locator('.tab-bar button').allTextContents()
    check('bottom navigation: Feed · Today · Calendar · Settings', tabs.join('|') === 'Feed|Today|Calendar|Settings', tabs.join('|'))
    check('no header icons any more', (await page.locator('.app-header .header-actions').count()) === 0)
    const chips = await page.locator('.chip-bar .bar-chip').allTextContents()
    check('one chip row: types, toggles, ⚙', chips.slice(0, 7).join('|') === 'All|Tasks|Events|Notes|Open|Today|With media', chips.join('|'))
    const headers = (await page.locator('.feed-group > h2').allTextContents()).map((h) => h.trim())
    check('section headers in order', /^Overdue\|Today\|Upcoming\|No date\|Notes\|Done \(2\)/.test(headers.join('|')), headers.join('|'))
    check('Done is folded', (await page.locator('.done-group .feed-row').count()) === 0)
    await shot('feed-v2-phone')
    await page.locator('.group-toggle').click()
    check('...and opens with a tap', (await page.locator('.done-group .feed-row').count()) === 2)
    check('an event shows its time badge', (await page.locator('.feed-row.kind-appointment .time-badge').count()) >= 2)
    check('high priority = the edge bar', (await page.locator('.feed-row.high').count()) === 1)
    check('rows lost the kind label, tags and place', (await page.locator('.feed-row .kind-label, .feed-row .tag, .feed-row .row-place').count()) === 0)

    await page.locator('.chip-bar .bar-chip', { hasText: 'Tasks' }).click()
    await page.waitForTimeout(800)
    const kinds = await page.locator('.feed-row').evaluateAll((rows) => rows.map((r) => r.className.match(/kind-(\w+)/)[1]))
    check('Tasks chip: only tasks', kinds.length > 0 && kinds.every((k) => k === 'task'), kinds.join(','))
    await page.locator('.chip-bar .bar-chip', { hasText: 'Today' }).click()
    await page.waitForTimeout(800)
    const todayRows = await page.locator('.feed-row .feed-title').allTextContents()
    check('Tasks + Today: today and overdue tasks', todayRows.includes('Overdue report') && todayRows.includes('Call the bank') && !todayRows.includes('Pay rent'), todayRows.join(', '))
    await page.locator('.chip-bar .bar-chip', { hasText: 'Today' }).click()
    await page.locator('.chip-bar .bar-chip', { hasText: 'All' }).click()

    await page.locator('.sheet-button').click()
    await page.locator('.sheet').waitFor()
    await shot('feed-v2-sheet')
    await page.locator('.sheet [role=radio]', { hasText: 'Newest' }).click()
    await page.locator('.sheet .primary', { hasText: 'Done' }).click()
    await page.waitForTimeout(800)
    const dayHeaders = await page.locator('.feed-group > h2').allTextContents()
    check('Newest from ⚙: day headers instead of sections, badge on ⚙', !dayHeaders.includes('Overdue') && (await page.locator('.sheet-button .chip-badge').textContent()) === '1', dayHeaders.slice(0, 3).join('|'))
    await page.locator('.sheet-button').click()
    await page.locator('.sheet [role=radio]', { hasText: 'Smart' }).click()
    await page.locator('.sheet .primary', { hasText: 'Done' }).click()

    await page.locator('.feed-search input').fill('dentist')
    await page.waitForTimeout(900)
    check('search: best matches', (await page.locator('.feed-group > h2').first().textContent()) === 'Best matches')
    await page.locator('.feed-search input').fill('')

    await page.locator('.tab-bar button', { hasText: 'Settings' }).click()
    await page.waitForURL('**/settings')
    const signOut = page.getByRole('button', { name: 'Sign out', exact: true })
    check('Settings tab: Sign out is there', await signOut.waitFor({ timeout: 8000 }).then(() => true, () => false))
    await page.locator('.tab-bar button', { hasText: 'Feed' }).click()
    await page.locator('.feed-row .feed-main').first().click()
    await page.waitForURL(/\/(tasks|appointments|notes)\//)
    await page.waitForTimeout(500)
    check('an item page: back arrow, no bottom bar', (await page.locator('.tab-bar').count()) === 0 && (await page.locator('.app-header .icon-button').count()) >= 1, `${page.url()} bars=${await page.locator('.tab-bar').count()} buttons=${await page.locator('.app-header .icon-button').count()}`)
    console.log('page errors:', errors.filter((e) => !/401/.test(e)))
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
