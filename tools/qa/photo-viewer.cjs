// The full-screen photo viewer (2026-10-27): the description no longer covers the picture (hidden until
// the i button), a click hides/shows the controls, and the picture zooms (wheel, double-click) and pans.
const { api, openApp } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const { execSync } = require('child_process')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const conn = fs.readFileSync(path.join(__dirname, '.local', 'conn.txt'), 'utf8')
const pw = conn.match(/Password=([^;]*)/)[1].trim(), db = conn.match(/Database=([^;]*)/)[1].trim()
const container = execSync('docker ps --format "{{.Names}}"').toString().split(/\r?\n/).find((n) => n.startsWith('postgres'))
const sql = (q) => execSync(`docker exec -e PGPASSWORD=${pw} ${container} psql -h localhost -U postgres -d ${db} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()

;(async () => {
  const { call } = await api()
  const note = (await call('POST', '/notes', { title: 'QA photo viewer', content: 'a photo' })).data
  try {
    const form = new FormData()
    form.append('file', new Blob([fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'store', 'feature-graphic.png'))], { type: 'image/png' }), 'cat.png')
    const att = (await call('POST', `/items/Note/${note.id}/attachments`, form)).data
    sql(`UPDATE "Attachments" SET "Description" = 'A happy cat face with a tick for a smile, on an indigo background.' WHERE "Id" = '${att.id}'`)

    const { browser, page, errors, shot } = await openApp({ width: 420, height: 860 })
    try {
      await page.goto(`http://localhost:5173/notes/${note.id}`)
      await page.locator('.media-thumb, .media-grid img, button:has(img)').first().click()
      await page.locator('.lightbox').waitFor({ timeout: 10000 })
      await page.waitForTimeout(800)
      check('the description is hidden at first', (await page.locator('.lightbox-caption').count()) === 0)
      const info = page.getByRole('button', { name: 'Description' })
      check('...with an i button to show it', (await info.count()) === 1)
      await info.click()
      check('the i button shows the description', (await page.locator('.lightbox-caption').textContent())?.includes('happy cat'))
      await shot('viewer-info')
      await info.click()
      check('...and hides it again', (await page.locator('.lightbox-caption').count()) === 0)

      const content = page.locator('.zoom-content')
      const scale = async () => Number((await content.getAttribute('style')).match(/scale\(([\d.]+)\)/)?.[1] ?? 1)
      await page.mouse.move(210, 430)
      await page.mouse.wheel(0, -600)
      await page.waitForTimeout(300)
      const zoomed = await scale()
      check('the wheel zooms in', zoomed > 1.5, String(zoomed))
      await shot('viewer-zoomed')
      await page.mouse.move(210, 430); await page.mouse.down(); await page.mouse.move(150, 380, { steps: 5 }); await page.mouse.up()
      check('dragging moves the zoomed picture', /translate\((?!0px, 0px)/.test(await content.getAttribute('style')), await content.getAttribute('style'))
      await page.mouse.dblclick(210, 430)
      await page.waitForTimeout(400)
      check('double-click goes back to fit', (await scale()) === 1)
      await page.mouse.dblclick(210, 430)
      await page.waitForTimeout(400)
      check('double-click zooms in', (await scale()) > 2)
      await page.mouse.dblclick(210, 430); await page.waitForTimeout(400)

      await page.mouse.click(210, 430)
      await page.waitForTimeout(500)
      check('a click hides the controls', !(await page.locator('.lightbox-close').isVisible()))
      await page.mouse.click(210, 430)
      await page.waitForTimeout(500)
      check('another click shows them again', await page.locator('.lightbox-close').isVisible())
      await page.keyboard.press('Escape')
      check('Esc closes', (await page.locator('.lightbox').count()) === 0)
      console.log('page errors:', errors)
    } finally {
      await browser.close()
    }
  } finally {
    await call('POST', '/items/delete', { items: [{ itemType: 'Note', id: note.id }] })
  }
})().catch((e) => { console.error(e); process.exit(1) })
