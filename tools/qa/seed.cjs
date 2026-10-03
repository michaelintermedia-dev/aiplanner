// Resets the QA account to a known state and seeds a varied data set (no AI calls).
//   node seed.cjs              reset + seed
//   node seed.cjs --reset-only reset only (end of a run)
// Only ever touches the QA account (feedtest@test.local).
const { api } = require('./lib.cjs')

const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 86400e3).toISOString()

;(async () => {
  const { call } = await api()

  // ---- reset: delete every item, back to default settings ----
  let removed = 0
  for (let guard = 0; guard < 50; guard++) {
    const page = await call('GET', '/feed?take=100')
    const items = page.data?.items ?? []
    if (items.length === 0) break
    await call('POST', '/items/delete', { items: items.map((i) => ({ itemType: i.kind, id: i.id })) })
    removed += items.length
  }
  await call('PATCH', '/users/me', { locale: 'en-US' })
  await call('PUT', '/settings/recordings', { shortenPauses: false })
  const notif = await call('GET', '/settings/notifications')
  if (notif.data) await call('PUT', '/settings/notifications', { ...notif.data, enabled: true, taskReminders: true, appointmentReminders: true })
  console.log(`reset: ${removed} item(s) deleted, settings back to defaults`)
  if (process.argv.includes('--reset-only')) return

  // ---- seed ----
  const made = []
  const task = async (b) => made.push((await call('POST', '/tasks', { priority: 'None', isOngoing: false, reminders: [], ...b })).data?.title)
  const event = async (b) => made.push((await call('POST', '/appointments', { reminders: [], ...b })).data?.title)
  const note = async (b) => made.push((await call('POST', '/notes', { reminders: [], ...b })).data?.title)

  await task({ title: 'Pay rent', dueDateUtc: inHours(30), hasDueTime: false, priority: 'High', tags: ['home', 'money'] })
  await task({ title: 'Call the bank', dueDateUtc: inHours(2), hasDueTime: true, reminders: [{ kind: 'Before', minutesBefore: 30 }], tags: ['money'] })
  await task({ title: 'Overdue report', dueDateUtc: daysAgo(2), hasDueTime: false, priority: 'Medium', tags: ['work'] })
  await task({ title: 'Learn Hebrew alphabet', isOngoing: true, reminders: [{ kind: 'Weekdays', time: '08:00' }] })
  await task({ title: 'A task with a very long title that keeps going to see how rows, headers and the review cope with wrapping text', description: 'Long description. '.repeat(20) })
  await task({ title: 'Купить подарок маме', dueDateUtc: inHours(72), hasDueTime: false, tags: ['семья'] })
  await task({ title: 'לקנות חלב', dueDateUtc: inHours(5), hasDueTime: true })
  const done = await call('POST', '/tasks', { title: 'Already done', priority: 'Low', isOngoing: false, reminders: [{ kind: 'At', atUtc: inHours(4) }] })
  await call('PATCH', `/tasks/${done.data.id}/complete`)
  made.push('Already done (completed)')

  await event({ title: 'Dentist', startUtc: inHours(26), endUtc: inHours(27), location: 'Main St 5', reminders: [{ kind: 'Before', minutesBefore: 60 }] })
  await event({ title: 'Team sync', startUtc: inHours(1), endUtc: inHours(1.5), participantNames: ['Anna', 'Ben'] })
  await event({ title: 'Last week workshop', startUtc: daysAgo(6), endUtc: new Date(Date.now() - 6 * 86400e3 + 7200e3).toISOString() })

  await note({ title: 'Gift ideas', content: 'Books, a plant, concert tickets' })
  await note({ title: null, content: 'A note without a title, just text that should become its title in lists' })
  await note({ title: 'Water the plants', content: 'Every morning', reminders: [{ kind: 'Daily', time: '09:00' }] })

  console.log(`seeded ${made.length}: ${made.join(' | ')}`)
})().catch((e) => {
  console.error(String(e))
  process.exit(1)
})
