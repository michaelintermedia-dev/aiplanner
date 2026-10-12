// Download my data + Delete my account, on a throwaway account full of every kind of data:
// the ZIP has it all, a wrong email deletes nothing, and deletion leaves no rows and no files.
const { API, waitForApi, spendAi } = require('./lib.cjs')
const fs = require('fs'), path = require('path'), os = require('os')
const { execSync } = require('child_process')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const conn = fs.readFileSync(path.join(__dirname, '.local', 'conn.txt'), 'utf8')
const pw = conn.match(/Password=([^;]*)/)[1].trim(), db = conn.match(/Database=([^;]*)/)[1].trim()
const container = execSync('docker ps --format "{{.Names}}"').toString().split('\n').find((n) => n.startsWith('postgres'))
const sql = (q) => execSync(`docker exec -e PGPASSWORD=${pw} ${container} psql -h localhost -U postgres -d ${db} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const storage = path.join(__dirname, '.local', 'api', 'App_Data', 'voice-captures')
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

;(async () => {
  await waitForApi()
  const email = `qa-delete-${Date.now().toString(36)}@test.local`
  const reg = await (await fetch(API + '/auth/register', json({ email, password: 'Delete!Me123', displayName: 'Delete Me', timeZoneId: 'Europe/Berlin', locale: 'en-US' }))).json()
  const auth = { Authorization: 'Bearer ' + reg.accessToken }
  const call = async (method, p, body) => {
    const form = body instanceof FormData
    const r = await fetch(API + p, { method, headers: form || body === undefined ? auth : { ...auth, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : form ? body : JSON.stringify(body) })
    const text = await r.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = text }
    return { status: r.status, data }
  }
  const id = reg.userId

  // every kind of data
  spendAi('text')
  const typed = (await call('POST', '/captures/text', { text: 'Dentist appointment next Tuesday at 10am', saveNow: true })).data
  spendAi('voice')
  const vf = new FormData()
  vf.append('audio', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'v-note1.wav'))], { type: 'audio/wav' }), 'v.wav')
  vf.append('saveNow', 'true')
  const voice = (await call('POST', '/captures/voice', vf)).data
  const task = (await call('POST', '/tasks', {
    title: 'Hand-made task', description: 'with a reminder and tags', dueDateUtc: new Date(Date.now() + 86400000).toISOString(), hasDueTime: true,
    tags: ['export', 'test'], reminders: [{ kind: 'Before', minutesBefore: 15 }], recurrence: { frequency: 'Daily', interval: 1 },
  })).data
  const photo = new FormData()
  photo.append('file', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'wall-task.png'))], { type: 'image/png' }), 'my photo.png')
  const att = await call('POST', `/items/Task/${task.id}/attachments`, photo)
  const wp = new FormData()
  wp.append('file', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'wall-task.png'))], { type: 'image/png' }), 'w.png')
  const wall = await call('PUT', '/settings/wallpaper', wp)
  const delTask = (await call('POST', '/tasks', { title: 'Deleted before export' })).data
  await call('POST', '/items/delete', { items: [{ itemType: 'Task', id: delTask.id }] })
  check('the account has data', typed?.items?.length > 0 && voice?.audioParts > 0 && task?.id && att.status === 201 && wall.status === 200,
    `typed ${typed?.items?.length} voice ${voice?.audioParts} att ${att.status} wall ${wall.status}`)
  await wait(3000) // AI usage rows are written in the background

  // Download my data
  const r = await fetch(API + '/users/me/export', { headers: auth })
  check('export: a ZIP', r.status === 200 && r.headers.get('content-type') === 'application/zip', `${r.status} ${r.headers.get('content-type')} ${r.headers.get('content-disposition')}`)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-'))
  fs.writeFileSync(path.join(dir, 'x.zip'), Buffer.from(await r.arrayBuffer()))
  execSync('C:/Windows/System32/tar.exe -xf x.zip', { cwd: dir }) // Windows' own tar reads ZIPs (Git Bash's doesn't)
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'))
  const titles = data.items.map((i) => i.title)
  const t = data.items.find((i) => i.title === 'Hand-made task')
  check('export: the account', data.account.email === email && data.account.timeZoneId === 'Europe/Berlin')
  const saved = 1 + [typed, voice].filter((c) => c.autoSaved).length // the AI may want a review first - then it's not an item yet
  check('export: every item, deleted ones left out', data.items.length === saved && !titles.includes('Deleted before export'), `${JSON.stringify(titles)} (expected ${saved})`)
  check('export: a task with its tags, reminder and repeat rule', t && t.tags.join() === 'export,test' && t.reminders.length === 1 && t.repeats?.frequency === 'Daily', JSON.stringify(t))
  check('export: the captures with their words',
    data.captures.length === 2 && data.captures.some((c) => /dentist/i.test(c.words)) && data.captures.some((c) => c.source === 'Voice' && c.recording?.length),
    JSON.stringify(data.captures.map((c) => [c.source, c.words?.slice(0, 30), c.recording])))
  const files = data.attachments.map((a) => a.file).concat(data.captures.flatMap((c) => c.recording ?? []), [data.settings.appearance.wallpaperPhoto])
  check('export: the photo, the recording and the wallpaper are in the ZIP',
    files.length === 3 && files.every((f) => fs.existsSync(path.join(dir, f)) && fs.statSync(path.join(dir, f)).size > 0), JSON.stringify(files))
  check('export: README', fs.existsSync(path.join(dir, 'README.txt')))

  // Delete my account
  const tables = ['Items', 'Reminders', 'Tags', 'Attachments', 'VoiceCaptures', 'Transcripts', 'AIExtractions', 'AIExtractionItems', 'RecurrenceRules', 'Notifications', 'UserSettings', 'RefreshTokens']
  const ownRows = () => Number(sql(`select ${tables.map((x) => `(select count(*) from "${x}" where "UserId"='${id}')`).join(' + ')} + (select count(*) from "Users" where "Id"='${id}')`))
  const filesOf = () => [id, id.replace(/-/g, '')].filter((d) => fs.existsSync(path.join(storage, d))).flatMap((d) => fs.readdirSync(path.join(storage, d), { recursive: true }))
  const usageBefore = Number(sql(`select count(*) from "AiUsage" where "UserId"='${id}'`))
  const anonBefore = Number(sql(`select count(*) from "AiUsage" where "UserId" is null`))
  check('before: rows and files exist', ownRows() > 10 && filesOf().length > 0, `rows ${ownRows()} files ${filesOf().length}`)
  const wrong = await call('DELETE', '/users/me', { confirmEmail: 'someone@else.com' })
  check('a wrong email deletes nothing', wrong.status === 400 && ownRows() > 10, `${wrong.status} ${JSON.stringify(wrong.data)}`)
  const del = await call('DELETE', '/users/me', { confirmEmail: email.toUpperCase() })
  check('the right email (any case) deletes', del.status === 204, `${del.status} ${JSON.stringify(del.data)}`)
  check('no rows left', ownRows() === 0, `rows ${ownRows()}`)
  check('no files left', filesOf().length === 0, JSON.stringify(filesOf()))
  const anonAfter = Number(sql(`select count(*) from "AiUsage" where "UserId" is null`))
  check('AI usage counts kept, pointing at nobody', usageBefore > 0 && anonAfter - anonBefore === usageBefore, `user had ${usageBefore}, anonymous ${anonBefore} -> ${anonAfter}`)
  const login = await fetch(API + '/auth/login', json({ email, password: 'Delete!Me123' }))
  check('cannot sign in any more', login.status === 401)
  const refresh = await fetch(API + '/auth/refresh', json({ refreshToken: reg.refreshToken }))
  check('the old session is dead', refresh.status === 401)
  const again = await fetch(API + '/auth/register', json({ email, password: 'Delete!Me123', displayName: 'Again', timeZoneId: 'UTC', locale: 'en-US' }))
  check('the email can sign up again', again.status === 200)
  const back = await again.json()
  await fetch(API + '/users/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + back.accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmEmail: email }) })
})().catch((e) => { console.error(e); process.exit(1) })
