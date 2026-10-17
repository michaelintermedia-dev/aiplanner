// Sharing into Gatazee and links: a shared YouTube link becomes a named note with the link kept (web share
// target /share), a page link gets its page title, and a link to a private address is never fetched.
const { api, openApp } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const log = path.join(__dirname, '.local', 'api.log')
;(async () => {
  const { call } = await api()
  const made = []
  const itemOf = async (c) => {
    const i = c.items[0]
    const type = i.resultingNoteId ? 'notes' : i.resultingTaskId ? 'tasks' : 'appointments'
    const id = i.resultingNoteId ?? i.resultingTaskId ?? i.resultingAppointmentId
    if (!id) return { title: i.title, text: i.description ?? '', saved: false }
    made.push({ itemType: type === 'notes' ? 'Note' : type === 'tasks' ? 'Task' : 'Appointment', id })
    const item = (await call('GET', `/${type}/${id}`)).data
    return { title: item.title ?? '', text: item.content ?? item.description ?? '', saved: true, type }
  }

  // 1. A page link: its title is looked up.
  const wiki = await itemOf((await call('POST', '/captures/text', { text: 'https://en.wikipedia.org/wiki/Tel_Aviv', saveNow: true })).data)
  check('a page link: named after the page', /tel aviv/i.test(wiki.title), JSON.stringify(wiki.title))
  check('a page link: the link is kept as written', wiki.text.includes('https://en.wikipedia.org/wiki/Tel_Aviv'), JSON.stringify(wiki.text))

  // 2. A private address is never fetched (no title), and the link still stays in the entry.
  const before = fs.readFileSync(log, 'utf8').length
  const internal = await itemOf((await call('POST', '/captures/text', { text: 'http://169.254.169.254/latest/meta-data/', saveNow: true })).data)
  const logged = fs.readFileSync(log, 'utf8').slice(before)
  check('a private address: not looked up (0 of 1 titled)', /Link previews: 0 of 1/.test(logged), (logged.match(/Link previews:[^\r\n]*/) ?? [''])[0])
  check('a private address: the link is still kept', internal.text.includes('169.254.169.254') || internal.title.includes('169.254.169.254'), JSON.stringify(internal))

  // 3. Shared from YouTube into the installed web app (share target), phone width.
  const { browser, page, errors, shot } = await openApp({ width: 420, height: 900 })
  try {
    const shared = encodeURIComponent('https://youtu.be/dQw4w9WgXcQ?si=abc')
    await page.goto(`http://localhost:5173/share?title=&text=${shared}`)
    await page.waitForURL(/\/feed/, { timeout: 10000 })
    await page.getByText(/Saved as/).first().waitFor({ timeout: 60000 })
    const notice = await page.getByText(/Saved as/).first().textContent()
    check('web share: saved at once, says what it became', /Saved as/.test(notice), notice)
    await shot('shared-youtube')
    const feed = (await call('GET', '/feed?take=10&sort=CreatedDesc')).data.items
    const newest = feed[0]
    const item = (await call('GET', `/${newest.kind === 'Note' ? 'notes' : newest.kind === 'Task' ? 'tasks' : 'appointments'}/${newest.id}`)).data
    made.push({ itemType: newest.kind, id: newest.id })
    const text = item.content ?? item.description ?? ''
    check('web share: a YouTube link becomes a note named after the video', newest.kind === 'Note' && /never gonna|rick astley/i.test(newest.title), `${newest.kind} ${JSON.stringify(newest.title)}`)
    check('web share: the link is kept, clickable', text.includes('https://youtu.be/dQw4w9WgXcQ?si=abc'), JSON.stringify(text))
    await page.goto(`http://localhost:5173/notes/${newest.id}`)
    await page.waitForTimeout(1500)
    check('the note shows the link as a link', (await page.locator('a.text-link[href^="https://youtu.be/"]').count()) >= 1)
    console.log('page errors:', errors)
  } finally {
    await browser.close()
  }
  await call('POST', '/items/delete', { items: made })
})().catch((e) => { console.error(e); process.exit(1) })
