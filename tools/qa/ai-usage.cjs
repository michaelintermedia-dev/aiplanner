// AI cost tracking: every kind of AI call shows up in the admin report, for the right user, with a cost.
const { api } = require('./lib.cjs')
const fs = require('fs'), path = require('path')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const { call } = await api()
  const me = (await call('GET', '/users/me')).data
  check('users/me says the QA account is admin', me.isAdmin === true)
  const before = (await call('GET', '/admin/ai-usage?days=1')).data
  const mine = (r) => r.users.find((u) => u.email === 'feedtest@test.local')?.totals ?? { messages: 0, transcriptions: 0, mediaDescriptions: 0, costUsd: 0 }

  // a typed message, a voice message, a photo described in the background
  const typed = (await call('POST', '/captures/text', { text: 'Buy light bulbs for the hallway tomorrow', saveNow: true })).data
  const f = new FormData(); f.append('audio', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'v-note1.wav'))], { type: 'audio/wav' }), 'v.wav'); f.append('saveNow', 'true')
  const voice = (await call('POST', '/captures/voice', f)).data
  const settings = (await call('GET', '/settings/recordings')).data
  await call('PUT', '/settings/recordings', { ...settings, aiReadsMedia: true })
  const it = typed.items[0]
  const id = it.resultingTaskId ?? it.resultingNoteId ?? it.resultingAppointmentId
  const type = it.resultingTaskId ? 'Task' : it.resultingNoteId ? 'Note' : 'Appointment'
  const photo = new FormData(); photo.append('file', new Blob([fs.readFileSync(path.join(__dirname, 'out', 'wall-task.png'))], { type: 'image/png' }), 'screen.png')
  const up = await call('POST', `/items/${type}/${id}/attachments`, photo)
  check('photo attached', up.status === 200 || up.status === 201, `status ${up.status}`)
  await wait(15000) // the describer is woken by the upload; rows are written in the background

  const after = (await call('GET', '/admin/ai-usage?days=1')).data
  const a = mine(after), b = mine(before)
  check('two more AI messages counted', a.messages - b.messages === 2, `${b.messages} -> ${a.messages}`)
  check('the voice message was transcribed and counted', a.transcriptions - b.transcriptions >= 1, `${b.transcriptions} -> ${a.transcriptions}`)
  check('the photo description counted', a.mediaDescriptions - b.mediaDescriptions === 1, `${b.mediaDescriptions} -> ${a.mediaDescriptions}`)
  check('it cost something', a.costUsd > b.costUsd, `$${b.costUsd} -> $${a.costUsd}`)
  check('every model has a price', after.unpricedModels.length === 0, JSON.stringify(after.unpricedModels))
  check('nothing counted for an unknown user', !after.users.some((u) => u.userId === null))
  const u = after.users.find((x) => x.email === 'feedtest@test.local')
  console.log('per message:', u.costPerMessageUsd, '| tokens in/out:', u.totals.inputTokens, u.totals.outputTokens, '| today:', JSON.stringify(after.perDay.at(-1)))

  await call('PUT', '/settings/recordings', settings)
  const del = [typed, voice].flatMap((c) => c.items).map((i) => ({ itemType: i.resultingTaskId ? 'Task' : i.resultingNoteId ? 'Note' : 'Appointment', id: i.resultingTaskId ?? i.resultingNoteId ?? i.resultingAppointmentId })).filter((x) => x.id)
  await call('POST', '/items/delete', { items: del })
})().catch((e) => { console.error(e); process.exit(1) })
