// Spec v2 (2026-10-31), steps 1-2: the AI's types and the default event reminder through the real API, then
// the web capture - one Save button, "Saved: ... [Undo] [Edit]", Undo removes it, and holding the bubble
// records: let go = saved, slide away = cancelled. Real AI calls (~7).
const { api, openApp } = require('./lib.cjs')
const path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)

;(async () => {
  const { call } = await api()
  const made = []
  const remember = (c) => c?.items?.forEach((i) => {
    if (i.resultingTaskId) made.push({ itemType: 'Task', id: i.resultingTaskId })
    if (i.resultingAppointmentId) made.push({ itemType: 'Appointment', id: i.resultingAppointmentId })
    if (i.resultingNoteId) made.push({ itemType: 'Note', id: i.resultingNoteId })
  })
  try {
    const say = async (text, saveNow = false) => {
      const r = (await call('POST', '/captures/text', { text, saveNow })).data
      remember(r)
      return r
    }
    // ---- the AI's rules ----
    const keys = await say('Find my car keys')
    check('"Find my car keys" is a task, not a search', !keys.search && keys.items?.[0]?.intent === 'Task', JSON.stringify({ search: keys.search, intent: keys.items?.[0]?.intent }))
    const wifi = await say('The wifi password at the cabin is sunflower42')
    check('a fact is a note', wifi.items?.[0]?.intent === 'Note', wifi.items?.[0]?.intent)
    const dentist = await say('Dentist next Tuesday at 4pm')
    const r = dentist.items?.[0]?.reminders ?? []
    check('an event gets the usual 15-minute reminder', dentist.items?.[0]?.intent === 'Appointment' && r.some((x) => x.kind === 'Before' && x.minutesBefore === 15), JSON.stringify(r))
    const quiet = await say('Team lunch on Friday at 1pm, no reminder please')
    check('"no reminder" means none', quiet.items?.[0]?.intent === 'Appointment' && (quiet.items?.[0]?.reminders ?? []).length === 0, JSON.stringify(quiet.items?.[0]?.reminders))
    const clear = await say('Call the plumber tomorrow at 10am', true)
    check('Save: clear -> saved at once', clear.autoSaved === true, `confidence ${clear.items?.[0]?.confidence}`)
    const vague = await say('the thing with Dana next week maybe', true)
    check('Save: vague -> left for review', vague.autoSaved !== true, `confidence ${vague.items?.[0]?.confidence} q=${vague.items?.[0]?.clarification}`)
    await call('POST', '/captures/pending/discard')

    // ---- the web capture ----
    const { browser, page, errors, shot } = await openApp({ width: 420, height: 900, micWav: path.join(__dirname, 'out', 'hold.wav') })
    try {
      await page.goto('http://localhost:5173/feed'); await page.waitForSelector('.feed-row, .empty')
      await page.locator('.dock-bubble').click()
      await page.waitForTimeout(400)
      check('a tap opens the bar ready to type', await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'))
      await page.keyboard.type('Water the plants tomorrow at 9am')
      check('one button: no Review any more', (await page.locator('.dock-panel .review-first').count()) === 0)
      await page.keyboard.press('Enter')
      const notice = page.locator('.dock-notice')
      await notice.waitFor({ timeout: 60000 })
      const text = await notice.textContent()
      check('toast: Saved: "title" · when, with Undo and Edit', /Saved: “.+” · /.test(text) && /Undo/.test(text) && /Edit/.test(text), text)
      await shot('capture-v2-toast')
      const feedHas = async (title) => (await call('GET', `/feed?take=30&q=${encodeURIComponent(title)}`)).data.items.filter((i) => i.title === 'Water plants').length
      check('...it is in the feed', (await feedHas('plants')) >= 1)
      await notice.getByRole('button', { name: 'Undo' }).click()
      await page.waitForTimeout(1500)
      check('Undo removes it', (await feedHas('plants')) === 0)

      // Hold the bubble: records; let go = saved.
      const bubble = page.locator('.dock-bubble')
      await bubble.waitFor({ state: 'visible', timeout: 10000 })
      const box = await bubble.boundingBox()
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2
      await page.mouse.move(cx, cy); await page.mouse.down()
      await page.waitForTimeout(3500) // the fake mic plays the words
      check('holding shows "Let go to save"', /Let go to save/.test(await page.locator('.dock-panel').textContent()))
      await page.mouse.up()
      await notice.waitFor({ timeout: 90000 })
      check('letting go saves it', /Saved: “/.test(await notice.textContent()), await notice.textContent())
      const saved = (await call('GET', '/feed?take=5&q=bread')).data.items
      saved.forEach((i) => made.push({ itemType: i.kind, id: i.id }))
      check('...the spoken words became the entry', saved.length >= 1, saved.map((i) => i.title).join(', '))

      // Hold and slide away: cancelled.
      await page.waitForTimeout(6000) // the notice goes, the bubble is back
      const box2 = await bubble.boundingBox()
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2); await page.mouse.down()
      await page.waitForTimeout(2000)
      await page.mouse.move(box2.x - 150, box2.y - 150, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(2500)
      check('sliding away cancels: nothing is sent', (await page.locator('.dock-notice').count()) === 0 && !/Transcribing|Understanding/.test(await page.locator('.dock-panel').textContent()))
      console.log('page errors:', errors.filter((e) => !/401/.test(e)))
    } finally {
      await browser.close()
    }
  } finally {
    await call('POST', '/captures/pending/discard')
    if (made.length) await call('POST', '/items/delete', { items: made })
  }
})().catch((e) => { console.error(e); process.exit(1) })
