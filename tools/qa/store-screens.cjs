// Phone screenshots for the store listings (docs/store/screenshots, 1080x2160).
// Resets the QA account, fills it with a realistic week (no real user data), and shoots the
// phone-width web app - the same screens as the Android app. One AI call (the review screen).
//   node tools/qa/store-screens.cjs      (QA API on :58600 and the web dev server on :5173)
const { api, openApp } = require('./lib.cjs')
const { execSync } = require('child_process')
const path = require('path'), fs = require('fs')
// The time zone can't be changed through the API, so it's set in the QA database directly.
const conn = fs.readFileSync(path.join(__dirname, '.local', 'conn.txt'), 'utf8')
const pw = conn.match(/Password=([^;]*)/)[1].trim(), db = conn.match(/Database=([^;]*)/)[1].trim()
const container = execSync('docker ps --format "{{.Names}}"').toString().split(/\r?\n/).find((n) => n.startsWith('postgres'))
const sql = (q) => execSync(`docker exec -e PGPASSWORD=${pw} ${container} psql -h localhost -U postgres -d ${db} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const setZone = (zone) => sql(`UPDATE "Users" SET "TimeZoneId" = '${zone}' WHERE "Email" = 'feedtest@test.local'`)
const OUT = path.join(__dirname, '..', '..', 'docs', 'store', 'screenshots')

// The account runs on New York time while shooting (UTC-4 in October), so it's daytime there for
// most of the Israeli day and "today" shows what's still ahead; set back to Jerusalem at the end.
const ZONE = 'America/New_York'
const OFFSET = -4
const at = (days, hour, minute = 0) => {
  const d = new Date(Date.now() + OFFSET * 3600000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, hour - OFFSET, minute)).toISOString()
}

;(async () => {
  execSync('node seed.cjs --reset-only', { cwd: __dirname, stdio: 'inherit' })
  const { call } = await api()
  const before = sql(`SELECT "TimeZoneId" FROM "Users" WHERE "Email" = 'feedtest@test.local'`)
  setZone(ZONE)
  const add = async (p, body) => {
    const r = await call('POST', p, body)
    if (r.status >= 300) throw new Error(`${p}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`)
    return r.data
  }

  // Oldest first, so the newest-first feed opens on the best ones.
  await add('/notes', { title: 'Wi-Fi at the cabin', content: 'Network: Cabin-5G\nPassword: on the fridge magnet', tags: ['home'] })
  const report = await add('/tasks', { title: 'Send the report to Dana', dueDateUtc: at(-1, 17), hasDueTime: true, tags: ['work'] })
  await call('PATCH', `/tasks/${report.id}/complete`)
  await add('/appointments', { title: 'Yoga', startUtc: at(2, 7, 30), endUtc: at(2, 8, 30), location: 'Studio Shanti', tags: ['sport'] })
  await add('/tasks', { title: 'Water the balcony plants', dueDateUtc: at(1, 8), hasDueTime: true, tags: ['home'],
    recurrence: { frequency: 'Daily', interval: 1 }, reminders: [{ kind: 'Before', minutesBefore: 0 }] })
  await add('/notes', { title: 'Gift ideas for Noa', content: '• Ceramics class\n• The new Murakami book\n• A lemon tree for her balcony', tags: ['family', 'gifts'] })
  await add('/appointments', { title: "Noa's birthday dinner", startUtc: at(5, 20), endUtc: at(5, 23), location: 'Café Noir, Tel Aviv',
    tags: ['family'], reminders: [{ kind: 'Before', minutesBefore: 1440 }] })
  await add('/tasks', { title: 'Pay the electricity bill', dueDateUtc: at(1, 0), hasDueTime: false, priority: 'High', tags: ['bills'],
    reminders: [{ kind: 'At', atUtc: at(1, 9) }] })
  await add('/appointments', { title: 'Team meeting', startUtc: at(0, 11), endUtc: at(0, 12), location: 'Office, 3rd floor', tags: ['work'],
    recurrence: { frequency: 'Weekly', interval: 1, days: [['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.now() + OFFSET * 3600000).getUTCDay()]] } })
  await add('/tasks', { title: 'Renew passport', dueDateUtc: at(3, 0), hasDueTime: false, priority: 'High', tags: ['documents'] })
  await add('/tasks', { title: 'Call mom', dueDateUtc: at(0, 19, 30), hasDueTime: true, tags: ['family'], reminders: [{ kind: 'Before', minutesBefore: 15 }] })
  const dentist = await add('/appointments', { title: 'Dentist – Dr. Levi', startUtc: at(1, 16), endUtc: at(1, 17),
    location: 'Dizengoff Center, Tel Aviv', tags: ['health'], reminders: [{ kind: 'Before', minutesBefore: 60 }] })
  await add('/tasks', { title: 'Buy oat milk and bread', dueDateUtc: at(0, 18), hasDueTime: true, tags: ['shopping'],
    reminders: [{ kind: 'Before', minutesBefore: 30 }] })

  const { browser, page, errors } = await openApp({ width: 400, height: 800, scale: 2.7 })
  const shot = async (name) => {
    await page.mouse.move(1, 1) // no hover look on the last thing clicked
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    console.log('shot', name)
  }
  try {
    await page.goto('http://localhost:5173/feed'); await page.waitForSelector('.feed-row')
    await shot('1-feed')

    await page.locator('.chip-bar .bar-chip', { hasText: 'Today' }).click(); await page.waitForTimeout(800)
    await shot('2-today')
    await page.locator('.chip-bar .bar-chip', { hasText: 'Today' }).click()

    await page.goto('http://localhost:5173/calendar'); await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Week' }).click().catch(() => {})
    await shot('3-calendar')

    await page.goto(`http://localhost:5173/appointments/${dentist.id}`); await page.waitForTimeout(1200)
    await shot('4-event')

    // The heart of it: say (here: type) something, and review what the AI understood.
    await page.goto('http://localhost:5173/feed'); await page.waitForSelector('.feed-row')
    await page.locator('.dock-bubble').click()
    await page.locator('.dock-panel textarea').fill('Lunch with Avi on Thursday at 1 at Port Said, remind me half an hour before')
    await page.getByRole('button', { name: /Review/ }).click()
    await page.waitForSelector('.review-header', { timeout: 60000 })
    await shot('5-review')
    await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {})

    await page.goto('http://localhost:5173/feed'); await page.waitForSelector('.feed-row')
    await page.locator('.feed-search input').fill('noa')
    await page.waitForTimeout(1500)
    await shot('6-search')

    console.log('page errors:', errors)
  } finally {
    await browser.close()
    setZone(before)
  }
})().catch((e) => { console.error(e); process.exit(1) })
