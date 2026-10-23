// "Show in your phone's calendar" (2026-10-23): the private feed link - off by default, a link to create,
// a valid iCalendar feed without signing in (events incl. a repeating one with a skipped date, dated
// tasks; no done tasks, no notes), a new link kills the old one, off = gone. Then the web's Settings.
const { api, API, openApp } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const day = (n, h) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + n, h)).toISOString()
const feedUrl = (url) => url.replace(/^https?:\/\/[^/]+/, API.replace(/\/api$/, '')) // the QA API, not the web dev server

;(async () => {
  const { call } = await api()
  const made = []
  const add = async (path, body, type) => { const r = await call('POST', path, body); made.push({ itemType: type, id: r.data.id }); return r.data }
  try {
    await call('DELETE', '/settings/calendar-feed')
    check('off by default', (await call('GET', '/settings/calendar-feed')).data.url === null)

    const once = await add('/appointments', { title: 'QA feed: dentist, Tel Aviv', startUtc: day(3, 13), endUtc: day(3, 14), location: 'Dizengoff, Tel Aviv' }, 'Appointment')
    const weekly = await add('/appointments', { title: 'QA feed: yoga', startUtc: day(1, 5), endUtc: day(1, 6), recurrence: { frequency: 'Weekly', interval: 1 } }, 'Appointment')
    await call('POST', `/appointments/${weekly.id}/skip?at=${encodeURIComponent(day(8, 5))}`)
    await add('/tasks', { title: 'QA feed: timed task', dueDateUtc: day(2, 9), hasDueTime: true }, 'Task')
    await add('/tasks', { title: 'QA feed: all-day task', dueDateUtc: day(4, 0), hasDueTime: false }, 'Task')
    const done = await add('/tasks', { title: 'QA feed: done task', dueDateUtc: day(2, 9), hasDueTime: true }, 'Task')
    await call('PATCH', `/tasks/${done.id}/complete`)
    await add('/notes', { title: 'QA feed: a note', content: 'not in calendars' }, 'Note')

    const url = (await call('POST', '/settings/calendar-feed')).data.url
    check('a link is created', /\/api\/calendar\/feed\/[A-Za-z0-9_-]{32}\.ics$/.test(url), url)
    const res = await fetch(feedUrl(url)) // no sign-in
    const ics = await res.text()
    check('the feed opens without signing in, as iCalendar', res.status === 200 && /text\/calendar/.test(res.headers.get('content-type')), `${res.status} ${res.headers.get('content-type')}`)
    const flat = ics.replace(/\r\n /g, '')
    check('it is a calendar with CRLF lines', ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trimEnd().endsWith('END:VCALENDAR'))
    check('the event, with its place escaped', flat.includes('SUMMARY:QA feed: dentist\\, Tel Aviv') && flat.includes('LOCATION:Dizengoff\\, Tel Aviv'))
    check('the repeating event, weekly, with the skipped date', flat.includes('SUMMARY:QA feed: yoga') && /RRULE:FREQ=WEEKLY;BYDAY=\w\w/.test(flat) && /EXDATE;TZID=/.test(flat))
    check('dated tasks: timed and all-day', flat.includes('SUMMARY:QA feed: timed task') && flat.includes('SUMMARY:QA feed: all-day task') && /DTSTART;VALUE=DATE:\d{8}/.test(flat))
    check('no done tasks, no notes, no alarms', !flat.includes('QA feed: done task') && !flat.includes('QA feed: a note') && !flat.includes('VALARM'))
    check('each entry links back to the app', flat.includes(`/appointments/${once.id}`))

    const newer = (await call('POST', '/settings/calendar-feed')).data.url
    check('a new link stops the old one', newer !== url && (await fetch(feedUrl(url))).status === 404 && (await fetch(feedUrl(newer))).status === 200)
    await call('DELETE', '/settings/calendar-feed')
    check('turned off: the link is gone', (await fetch(feedUrl(newer))).status === 404 && (await call('GET', '/settings/calendar-feed')).data.url === null)

    const { browser, page, errors, shot } = await openApp({ width: 420, height: 1000 })
    try {
      await page.goto('http://localhost:5173/settings'); await page.waitForTimeout(1500)
      await page.getByRole('button', { name: 'Create a private link' }).click()
      const google = page.getByRole('link', { name: 'Add to Google Calendar' })
      await google.waitFor({ timeout: 10000 })
      const href = await google.getAttribute('href')
      check('web: "Add to Google Calendar" subscribes by webcal link', href.startsWith('https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2F'), href.slice(0, 90))
      check('web: "Add to Apple Calendar / Outlook" is a webcal link', (await page.getByRole('link', { name: /Apple Calendar/ }).getAttribute('href')).startsWith('webcal://'))
      await page.locator('.calendar-feed').scrollIntoViewIfNeeded()
      await shot('calendar-feed')
      await page.getByRole('button', { name: 'Turn off' }).click(); await page.waitForTimeout(800)
      check('web: Turn off goes back to "Create a private link"', (await page.getByRole('button', { name: 'Create a private link' }).count()) === 1)
      console.log('page errors:', errors)
    } finally {
      await browser.close()
    }
  } finally {
    await call('DELETE', '/settings/calendar-feed')
    await call('POST', '/items/delete', { items: made })
  }
})().catch((e) => { console.error(e); process.exit(1) })
