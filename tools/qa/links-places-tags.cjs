// The feed's mic only on spoken entries; links in an item's text open; its place offers Google Maps / Waze /
// Apple Maps; the tag picker shows the item's tags + a few suggestions (not every tag); "Use my location".
const { api, openApp, spendAi } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
;(async () => {
  const { call } = await api()
  const task = (await call('POST', '/tasks', {
    title: 'Watch the talk', description: 'Here: https://youtu.be/dQw4w9WgXcQ. Slides at www.example.com/slides.',
    location: 'Dizengoff Center, Tel Aviv', tags: ['video'],
  })).data
  for (let i = 0; i < 12; i++) await call('POST', '/tasks', { title: `tag filler ${i}`, tags: [`filler-${i}`] })
  spendAi('typed')
  const typed = (await call('POST', '/captures/text', { text: 'Buy oat milk', saveNow: true })).data
  spendAi('voice')
  const vf = new FormData()
  vf.append('audio', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'v-note1.wav'))], { type: 'audio/wav' }), 'v.wav')
  vf.append('saveNow', 'true')
  const voice = (await call('POST', '/captures/voice', vf)).data
  const idOf = (c) => c.items[0].resultingTaskId ?? c.items[0].resultingNoteId ?? c.items[0].resultingAppointmentId

  const feed = (await call('GET', '/feed?take=60')).data.items
  const rowOf = (id) => feed.find((x) => x.id === id)
  check('feed: a typed entry is not "from voice"', rowOf(idOf(typed))?.fromVoice === false && rowOf(idOf(typed))?.fromCapture === true)
  check('feed: a spoken entry is "from voice"', rowOf(idOf(voice))?.fromVoice === true)
  check('feed: a hand-made item is neither', rowOf(task.id)?.fromVoice === false && rowOf(task.id)?.fromCapture === false)

  const { browser, page, errors, shot } = await openApp({ width: 420, height: 1100 })
  try {
    await page.goto('http://localhost:5173/feed'); await page.waitForTimeout(2500)
    const micOn = async (title) => page.locator('.feed-row', { hasText: title }).first().locator('svg[aria-label="Recorded by voice"]').count()
    check('feed row: no mic on the typed entry', (await micOn(typed.items[0].title)) === 0)
    check('feed row: a mic on the spoken entry', (await micOn(voice.items[0].title)) === 1)

    await page.goto(`http://localhost:5173/tasks/${task.id}`); await page.waitForTimeout(1500)
    const links = await page.locator('.text-block a.text-link').evaluateAll((as) => as.map((a) => [a.textContent, a.href, a.target]))
    check('item text: both links clickable, opening in a new tab', links.length === 2 && links[0][1] === 'https://youtu.be/dQw4w9WgXcQ' && links[1][1] === 'https://www.example.com/slides' && links.every((l) => l[2] === '_blank'), JSON.stringify(links))
    await page.locator('.place-button').click()
    const menu = await page.locator('.place-menu a').evaluateAll((as) => as.map((a) => [a.textContent, a.href]))
    check('place: Google Maps, Waze, Apple Maps', menu.length === 3 && /google\.com\/maps/.test(menu[0][1]) && /waze\.com\/ul\?q=Dizengoff/.test(menu[1][1]), JSON.stringify(menu))
    await shot('place-menu')

    await page.goto(`http://localhost:5173/tasks/${task.id}?edit=1`); await page.waitForTimeout(1500)
    const picker = page.locator('.tag-picker')
    await picker.scrollIntoViewIfNeeded()
    check('tags: the item\'s tag as a removable chip', (await picker.locator('.tag-chip').count()) === 1)
    const suggested = await picker.locator('.tag-suggestions button').count()
    check('tags: only a few suggestions, not every tag', suggested > 0 && suggested <= 6, `${suggested}`)
    check('tags: "All tags (N)" link', /All tags \(\d+\)/.test(await picker.locator('.tag-all').textContent()))
    await picker.locator('input').fill('fill')
    const matches = await picker.locator('.tag-suggestions button:not(.tag-create)').allTextContents()
    check('tags: typing shows the matching tags', matches.length > 0 && matches.every((m) => /filler/.test(m)), JSON.stringify(matches))
    await picker.locator('.tag-suggestions button').first().click()
    check('tags: tapping a suggestion adds it (not the half-typed text)', (await picker.locator('.tag-chip').allTextContents()).some((x) => /filler-/.test(x)) && !(await picker.locator('.tag-chip').allTextContents()).some((x) => /#fill$/.test(x)), JSON.stringify(await picker.locator('.tag-chip').allTextContents()))
    await picker.locator('input').fill('brandnew')
    check('tags: "Create" for a new name', /Create/.test(await picker.locator('.tag-create').textContent()))
    await picker.locator('input').press('Enter')
    check('tags: Enter adds it', (await picker.locator('.tag-chip').count()) === 3)
    await picker.locator('.tag-chip button').first().click()
    check('tags: x removes it', (await picker.locator('.tag-chip').count()) === 2)
    await shot('tag-picker')

    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: 32.0853, longitude: 34.7818 })
    await page.getByRole('button', { name: 'Use my location' }).click()
    await page.waitForTimeout(800)
    check('Use my location fills in the coordinates', (await page.locator('#place-input').inputValue()) === '32.08530, 34.78180', await page.locator('#place-input').inputValue())
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    console.log('page errors:', errors)
  } finally {
    await browser.close()
  }
  const all = (await call('GET', '/feed?take=100')).data.items.filter((x) => /^tag filler|Watch the talk/.test(x.title) || [idOf(typed), idOf(voice)].includes(x.id))
  await call('POST', '/items/delete', { items: all.map((x) => ({ itemType: x.kind, id: x.id })) })
})().catch((e) => { console.error(e); process.exit(1) })
