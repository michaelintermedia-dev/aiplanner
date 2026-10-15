// An event that's over sends no more reminders (user's rule, 2026-10-15): a daily reminder on an event that
// ended an hour ago is not in the upcoming notifications and gives its feed row no bell; the same reminder on
// an event tomorrow still does, until the event.
const { api } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
;(async () => {
  const { call } = await api()
  const h = (n) => new Date(Date.now() + n * 3600000).toISOString()
  const remind = [{ kind: 'Daily', time: '08:00' }, { kind: 'At', atUtc: h(30) }]
  const past = (await call('POST', '/appointments', { title: 'QA passed event', startUtc: h(-2), endUtc: h(-1), reminders: remind })).data
  const soon = (await call('POST', '/appointments', { title: 'QA event in 2 days', startUtc: h(48), endUtc: h(49), reminders: remind })).data
  check('setup', !!past?.id && !!soon?.id, JSON.stringify(past).slice(0, 200))
  try {
    const up = (await call('GET', '/notifications/upcoming?hours=96')).data
    const of = (id) => up.filter((n) => n.itemId === id)
    check('passed event: no reminders at all', of(past.id).length === 0, JSON.stringify(of(past.id).map((n) => n.atUtc)))
    const soonAt = of(soon.id).map((n) => n.atUtc)
    check('future event: its reminders still come', soonAt.length >= 2, JSON.stringify(soonAt))
    check('...none after the event ends', soonAt.every((t) => new Date(t) <= new Date(soon.endUtc)), JSON.stringify(soonAt))
    const feed = (await call('GET', '/feed?take=100&kinds=Appointment')).data.items
    check('feed: no bell on the passed event', feed.find((i) => i.id === past.id)?.nextReminderUtc == null)
    check('feed: a bell on the future one', !!feed.find((i) => i.id === soon.id)?.nextReminderUtc)
  } finally {
    await call('POST', '/items/delete', { items: [past, soon].filter((x) => x?.id).map((x) => ({ itemType: 'Appointment', id: x.id })) })
  }
})().catch((e) => { console.error(e); process.exit(1) })
