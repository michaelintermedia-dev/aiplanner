import type { Reminder } from '@shared/types'
import { useState } from 'react'
import { ReminderPicker } from './ReminderPicker'
import { t } from '@shared/i18n'

/**
 * All of an item's reminders ("remind me at 3 and at 4"): one ReminderPicker
 * per reminder plus an "Add a reminder" one at the end.
 */
export function ReminderList({
  value,
  onChange,
  itemHasTime,
  isNote = false,
  showProblem = true,
}: {
  value: Reminder[]
  onChange: (reminders: Reminder[]) => void
  itemHasTime: boolean
  isNote?: boolean
  showProblem?: boolean
}) {
  // Which picker is open: an index, 'new' for the add-picker, or none.
  const [openAt, setOpenAt] = useState<number | 'new' | null>(null)

  return (
    <div className="reminder-list">
      {value.map((reminder, i) => (
        <ReminderPicker
          key={i}
          value={reminder}
          onChange={(next) => {
            onChange(next ? value.map((r, j) => (j === i ? next : r)) : value.filter((_, j) => j !== i))
            if (!next) setOpenAt(null)
          }}
          itemHasTime={itemHasTime}
          isNote={isNote}
          showProblem={showProblem}
          open={openAt === i}
          onOpenChange={(open) => setOpenAt(open ? i : null)}
        />
      ))}
      <ReminderPicker
        value={null}
        // A preset adds and closes; picking a kind adds and keeps editing it.
        onChange={(next) => {
          if (!next) return
          onChange([...value, next])
          setOpenAt((o) => (o === 'new' ? value.length : o))
        }}
        itemHasTime={itemHasTime}
        isNote={isNote}
        showProblem={false}
        open={openAt === 'new'}
        onOpenChange={(open) => setOpenAt(open ? 'new' : null)}
        emptyLabel={value.length ? t('reminder.addAnother') : t('reminder.add')}
      />
    </div>
  )
}
