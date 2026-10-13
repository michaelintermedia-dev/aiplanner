// Filters strategy (2026-10-13): best-match order while searching, the new filters (photo / document / link /
// place, spoken / typed / by hand, upcoming) on the API; on the web: the search box on top with the words
// marked, the quick views and the grouped panel. No AI calls.
const { api, openApp } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

;(async () => {
  const { call } = await api()
  const tag = `qf${Date.now().toString(36)}`
  const made = []
  const task = async (body) => {
    const r = await call('POST', '/tasks', { ...body, tags: [tag] })
    made.push(r.data.id)
    return r.data
  }
  // Oldest first: newest-first alone would put the weakest match on top.
  const notTitle = await task({ title: 'Call the bank', description: `about the car insurance ${tag}` })
  const one = await task({ title: `Car service ${tag}`, description: 'insurance papers in the glovebox' })
  const scattered = await task({ title: `Insurance papers for the car ${tag}` })
  const phrase = await task({ title: `Renew car insurance ${tag}` })
  const tomorrow = new Date(Date.now() + 86400000).toISOString()
  const withPlace = await task({ title: `Pick up keys ${tag}`, location: 'Dizengoff Center', dueDateUtc: tomorrow, hasDueTime: true })
  const withLink = await task({ title: `Read article ${tag}`, description: 'https://example.com/a' })
  const withPhoto = await task({ title: `Lamp photo ${tag}` })
  const form = new FormData()
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'lamp.png')
  const up = await call('POST', `/items/Task/${withPhoto.id}/attachments`, form)
  check('setup: photo uploaded', up.status === 200 || up.status === 201, String(up.status))

  try {
    const ids = async (qs) => (await call('GET', `/feed?take=50&tags=${tag}&${qs}`)).data.items.map((i) => i.id)
    const rel = await ids('q=car%20insurance&sort=Relevance,CreatedDesc')
    check('search: whole phrase in the title first, then scattered, then one word, then text only',
      JSON.stringify(rel) === JSON.stringify([phrase.id, scattered.id, one.id, notTitle.id]), JSON.stringify(rel.map((id) => made.indexOf(id))))
    const plain = await ids('q=car%20insurance&sort=CreatedDesc')
    check('without Relevance: newest first as before', plain[0] === phrase.id && plain[3] === notTitle.id)

    check('has photo: only the lamp', JSON.stringify(await ids('hasPhoto=true')) === JSON.stringify([withPhoto.id]))
    check('has document: none', (await ids('hasFile=true')).length === 0)
    check('has place: only the keys', JSON.stringify(await ids('hasPlace=true')) === JSON.stringify([withPlace.id]))
    check('has link: only the article', JSON.stringify(await ids('hasLink=true')) === JSON.stringify([withLink.id]))
    check('made by hand: all 7', (await ids('origin=Manual')).length === 7)
    check('spoken / typed: none of these', (await ids('origin=Voice')).length === 0 && (await ids('origin=Typed')).length === 0)
    check('upcoming (dateFrom now): only the dated one', JSON.stringify(await ids(`dateFrom=${encodeURIComponent(new Date().toISOString())}`)) === JSON.stringify([withPlace.id]))
    check('fromVoice=true (old apps) still works', (await ids('fromVoice=true')).length === 0)

    // ---- web ----
    for (const width of [420, 1280]) {
      const { browser, page, errors, shot } = await openApp({ width, height: 1000 })
      try {
        await page.goto('http://localhost:5173/feed'); await page.waitForTimeout(2000)
        check(`${width}: the search box is on top, outside the panel`, (await page.locator('.feed-search input').count()) === 1 && (await page.locator('.filter-panel').count()) === 0)
        check(`${width}: 8 quick views`, (await page.locator('.quick-view').count()) === 8)
        await page.locator('.feed-search input').fill(`car insurance ${tag}`)
        await page.waitForTimeout(1500)
        const titles = await page.locator('.feed-row .feed-title').allTextContents()
        check(`${width}: search: best match first, one "Best matches" group`, titles[0]?.startsWith('Renew car insurance') && (await page.locator('.feed-group > h2').allTextContents()).join() === 'Best matches', JSON.stringify(titles))
        const marks = await page.locator('.feed-row mark').allTextContents()
        check(`${width}: the words are marked`, marks.some((m) => m.toLowerCase() === 'car') && marks.some((m) => m.toLowerCase() === 'insurance'), JSON.stringify(marks.slice(0, 6)))
        check(`${width}: the sort chips step aside while searching`, (await page.locator('.sort-chip-anchor').count()) === 0)
        await shot(`feed-search-${width}`)
        await page.locator('.feed-search button').click()
        check(`${width}: × clears the search`, (await page.locator('.feed-search input').inputValue()) === '')

        await page.locator('.quick-view', { hasText: 'Upcoming' }).click(); await page.waitForTimeout(1500)
        check(`${width}: Upcoming: on, the dated item listed`, (await page.locator('.quick-view.active').textContent())?.includes('Upcoming') && (await page.locator('.feed-row', { hasText: `Pick up keys ${tag}` }).count()) === 1)
        check(`${width}: ...and no other filter chips`, (await page.locator('.filter-chip').count()) === 0)
        await page.locator('.quick-view', { hasText: 'Open tasks' }).click(); await page.waitForTimeout(1200)
        check(`${width}: Open tasks opens the Tasks tab`, page.url().includes('show=tasks'))
        await page.locator('.quick-view', { hasText: 'Open tasks' }).click(); await page.waitForTimeout(800)
        check(`${width}: tapping it again clears it`, (await page.locator('.quick-view.active').count()) === 0)
        await page.locator('.quick-view', { hasText: 'With photos' }).click(); await page.waitForTimeout(1500)
        check(`${width}: With photos: the lamp`, (await page.locator('.feed-row', { hasText: `Lamp photo ${tag}` }).count()) === 1 && (await page.locator('.feed-row', { hasText: `Pick up keys ${tag}` }).count()) === 0)
        await page.locator('.quick-view', { hasText: 'With photos' }).click()

        await page.locator('.filter-toggle', { hasText: 'Filter' }).click()
        const groups = await page.locator('.filter-panel > .filter-group > .caption').allTextContents()
        check(`${width}: panel grouped What / When / Status / Made`, groups.join('|').toLowerCase() === 'what|when|status|made', groups.join('|'))
        await page.locator('.filter-panel .chip-button', { hasText: 'Place' }).click()
        await page.locator('.filter-panel [role=radio]', { hasText: 'Made by hand' }).click()
        await page.waitForTimeout(1500)
        const rows = await page.locator('.feed-row').count()
        check(`${width}: Place + Made by hand: every row has a place, the keys among them`, rows > 0 && (await page.locator('.feed-row .row-place').count()) === rows && (await page.locator('.feed-row', { hasText: `Pick up keys ${tag}` }).count()) === 1, String(rows))
        await shot(`feed-panel-${width}`)
        await page.locator('.filter-panel button.primary').click()
        const chips = await page.locator('.filter-chip').allTextContents()
        check(`${width}: shown as chips`, chips.length === 2, JSON.stringify(chips))
        await page.getByRole('button', { name: 'Clear all' }).click()
        console.log(`${width} page errors:`, errors)
      } finally {
        await browser.close()
      }
    }
  } finally {
    await call('POST', '/items/delete', { items: made.map((id) => ({ itemType: 'Task', id })) })
  }
})().catch((e) => { console.error(e); process.exit(1) })
