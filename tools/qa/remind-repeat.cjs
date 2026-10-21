// "Remind me every day ..." without a date (bug, 2026-10-21): a task with a repeating reminder - never a
// repeating task that can't be saved without a date. Real AI calls (4); each capture is checked, then
// saved with Save (saveNow) where it's clear, and everything made is deleted again.
const { api } = require('./lib.cjs')
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)

const CASES = [
  { text: 'Remind me every day to drink water', reminder: 'Daily' },
  { text: 'Remind me every day at 8 in the morning to take my vitamins', reminder: 'Daily' },
  { text: 'Remind me on weekdays at 7pm to stretch', reminder: 'Weekdays' },
  { text: 'Remind me for the next 3 days at 10 to call the bank', reminders: 3 },
]

;(async () => {
  const { call } = await api()
  const made = []
  try {
    for (const c of CASES) {
      const r = await call('POST', '/captures/text', { text: c.text })
      const item = r.data?.items?.[0]
      const kinds = (item?.reminders ?? []).map((x) => x.kind)
      const detail = JSON.stringify({ intent: item?.intent, due: item?.dueUtc ?? item?.date, recurrence: item?.recurrence ?? item?.recurrenceRule, kinds, q: item?.clarification })
      check(`"${c.text}": no repeating task`, item && !item.recurrence && !item.recurrenceRule, detail)
      if (c.reminder) check('...a repeating reminder instead', kinds.includes(c.reminder), detail)
      if (c.reminders) check(`...${c.reminders} reminders, one a day`, kinds.filter((k) => k === 'At').length === c.reminders, detail)

    }
  } finally {
    await call('POST', '/captures/pending/discard') // the reviews this left open
  }
})().catch((e) => { console.error(e); process.exit(1) })
