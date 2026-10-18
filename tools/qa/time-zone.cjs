// Settings - Time zone (2026-10-18): the API moves the account to another zone; a task with a date but
// no time stays on the same calendar day, a timed event keeps its real moment, a bad zone is refused.
// Then the web's Settings: the section, the search, choosing a city. The QA account's zone is put back.
const { api, openApp } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const localDay = (utc, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(utc))

;(async () => {
  const { call } = await api()
  const original = (await call('GET', '/users/me')).data.timeZoneId
  const made = []
  try {
    // A due date with no time = midnight in the account's zone.
    const day = new Date(Date.now() + 5 * 86400000)
    const dayKey = localDay(day.toISOString(), original)
    const midnight = new Date(`${dayKey}T00:00:00Z`)
    const offset = (Date.parse(new Date(midnight).toLocaleString('en-US', { timeZone: original })) - Date.parse(new Date(midnight).toLocaleString('en-US', { timeZone: 'UTC' })))
    const allDayUtc = new Date(midnight.getTime() - offset).toISOString()
    const task = (await call('POST', '/tasks', { title: 'QA all-day task', dueDateUtc: allDayUtc, hasDueTime: false })).data
    const event = (await call('POST', '/appointments', { title: 'QA timed event', startUtc: '2026-12-01T14:00:00Z', endUtc: '2026-12-01T15:00:00Z' })).data
    made.push(['Task', task.id], ['Appointment', event.id])
    check('setup: the task is on its day in the old zone', localDay(task.dueDateUtc, original) === dayKey, `${task.dueDateUtc} ${dayKey}`)

    const moved = await call('PATCH', '/users/me', { timeZoneId: 'America/New_York' })
    check('PATCH timeZoneId: saved', moved.status === 200 && moved.data.timeZoneId === 'America/New_York', JSON.stringify(moved.data).slice(0, 120))
    const taskAfter = (await call('GET', `/tasks/${task.id}`)).data
    check('the all-day task stays on the same day in the new zone', localDay(taskAfter.dueDateUtc, 'America/New_York') === dayKey, `${taskAfter.dueDateUtc}`)
    const eventAfter = (await call('GET', `/appointments/${event.id}`)).data
    check('the timed event keeps its moment', eventAfter.startUtc.startsWith('2026-12-01T14:00:00'), eventAfter.startUtc)
    const bad = await call('PATCH', '/users/me', { timeZoneId: 'Mars/Olympus' })
    check('an unknown zone is refused', bad.status === 400, String(bad.status))
    const locale = await call('PATCH', '/users/me', { locale: 'en-US' })
    check('changing only the language leaves the zone', locale.data.timeZoneId === 'America/New_York')
    await call('PATCH', '/users/me', { timeZoneId: original })

    const { browser, page, errors, shot } = await openApp({ width: 420, height: 1000 })
    try {
      await page.goto('http://localhost:5173/settings'); await page.waitForTimeout(1500)
      check('web: the Time zone section shows the account zone', (await page.getByText('Time zone', { exact: true }).count()) === 1)
      await page.getByLabel('Search a city or region').fill('rome')
      const hit = page.getByRole('button', { name: /^Rome \(GMT/ })
      check('web: searching "rome" offers Rome with its offset', (await hit.count()) === 1)
      await hit.click(); await page.waitForTimeout(1500)
      check('web: choosing it moves the account', (await call('GET', '/users/me')).data.timeZoneId === 'Europe/Rome')
      check('web: the section shows Rome now', (await page.locator('section', { hasText: 'Time zone' }).getByText(/^Rome \(GMT/).count()) === 1)
      await page.locator('section', { hasText: 'Time zone' }).scrollIntoViewIfNeeded()
      await shot('settings-time-zone')
      console.log('page errors:', errors)
    } finally {
      await browser.close()
    }
  } finally {
    await call('PATCH', '/users/me', { timeZoneId: original })
    if (made.length) await call('POST', '/items/delete', { items: made.map(([itemType, id]) => ({ itemType, id })) })
  }
})().catch((e) => { console.error(e); process.exit(1) })
