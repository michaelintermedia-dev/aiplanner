// Deleted entries are erased for good after 30 days (DeletedItemPurge, run a minute after the API starts,
// then every 6 hours). Two phases:  node purge.cjs setup   -> restart the QA API -> wait ~75 s ->  node purge.cjs check
const { api } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const { execSync } = require('child_process')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const conn = fs.readFileSync(path.join(__dirname, '.local', 'conn.txt'), 'utf8')
const pw = conn.match(/Password=([^;]*)/)[1].trim(), db = conn.match(/Database=([^;]*)/)[1].trim()
const container = execSync('docker ps --format "{{.Names}}"').toString().split(/\r?\n/).find((n) => n.startsWith('postgres'))
const sql = (q) => execSync(`docker exec -e PGPASSWORD=${pw} ${container} psql -h localhost -U postgres -d ${db} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const STATE = path.join(__dirname, '.local', 'purge-state.json')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

;(async () => {
  const { call } = await api()
  if (process.argv[2] === 'setup') {
    const old = (await call('POST', '/tasks', { title: 'QA purge: old task', dueDateUtc: new Date(Date.now() + 86400000).toISOString(), hasDueTime: true,
      reminders: [{ kind: 'Before', minutesBefore: 10 }] })).data
    const note = (await call('POST', '/notes', { title: 'QA purge: old note', content: 'with a photo' })).data
    const form = new FormData()
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'p.png')
    const att = (await call('POST', `/items/Note/${note.id}/attachments`, form)).data
    const fresh = (await call('POST', '/tasks', { title: 'QA purge: deleted today' })).data
    await call('POST', '/items/delete', { items: [{ itemType: 'Task', id: old.id }, { itemType: 'Note', id: note.id }, { itemType: 'Task', id: fresh.id }] })
    sql(`UPDATE "Items" SET "UpdatedAtUtc" = now() - interval '31 days' WHERE "Id" IN ('${old.id}', '${note.id}')`)
    const key = sql(`SELECT "StorageKey" FROM "Attachments" WHERE "Id" = '${att.id}'`)
    fs.writeFileSync(STATE, JSON.stringify({ old: old.id, note: note.id, fresh: fresh.id, att: att.id, key }))
    console.log('set up - restart the QA API, wait ~75 s, then: node purge.cjs check')
    return
  }
  const s = JSON.parse(fs.readFileSync(STATE, 'utf8'))
  const count = (q) => Number(sql(q))
  check('the task deleted 31 days ago is gone', count(`SELECT count(*) FROM "Items" WHERE "Id" = '${s.old}'`) === 0)
  check('...with its reminder', count(`SELECT count(*) FROM "Reminders" WHERE "TaskItemId" = '${s.old}'`) === 0)
  check('the old note is gone, with its attachment row', count(`SELECT count(*) FROM "Items" WHERE "Id" = '${s.note}'`) === 0 && count(`SELECT count(*) FROM "Attachments" WHERE "Id" = '${s.att}'`) === 0)
  const file = path.join(__dirname, '.local', 'api', 'App_Data', 'voice-captures', ...s.key.split('/'))
  check('...and its file', !fs.existsSync(file), file)
  check('the one deleted today stays (Undo still works)', count(`SELECT count(*) FROM "Items" WHERE "Id" = '${s.fresh}' AND "IsDeleted"`) === 1)
  await call('POST', '/items/restore', { items: [{ itemType: 'Task', id: s.fresh }] })
  await call('POST', '/items/delete', { items: [{ itemType: 'Task', id: s.fresh }] })
  fs.unlinkSync(STATE)
})().catch((e) => { console.error(e); process.exit(1) })
