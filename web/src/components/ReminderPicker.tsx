import { dateKey, timeKey, zonedToUtc } from '@shared/dates'
import {
  BEFORE_CHOICES,
  describeReminder,
  minutesBeforeLabel,
  REMINDER_KINDS,
  reminderOfKind,
  reminderPresets,
  reminderProblem,
  repeats,
  WEEKDAYS,
} from '@shared/reminders'
import type { Reminder } from '@shared/types'
import { useState } from 'react'
import { IoClose, IoNotificationsOutline, IoRepeat } from 'react-icons/io5'
import { useAuth } from '../auth/useAuth'

/**
 * The one reminder control, used wherever an item is created or edited.
 * Collapsed it reads "Every day at 8:00 AM"; open it offers one-tap presets
 * ("In 1 hour", "Tomorrow 9:00", "10 min before"...) and a small editor for
 * once / before / every day / weekdays / weekly.
 */
export function ReminderPicker({
  value,
  onChange,
  itemHasTime,
  isNote = false,
  showProblem = true,
}: {
  value: Reminder | null
  onChange: (reminder: Reminder | null) => void
  /** The item has its own time, so "before it" makes sense. */
  itemHasTime: boolean
  isNote?: boolean
  /** Off where the caller already lists problems (the capture review). */
  showProblem?: boolean
}) {
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const problem = reminderProblem(value, { itemHasTime, isNote })
  const kinds = REMINDER_KINDS.filter((k) => k.kind !== 'Before' || (!isNote && (itemHasTime || value?.kind === 'Before')))

  return (
    <div className={`reminder-picker${open ? ' open' : ''}`}>
      <div className="reminder-summary">
        <button type="button" className="reminder-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {repeats(value) ? <IoRepeat aria-hidden /> : <IoNotificationsOutline aria-hidden />}
          <span className={value ? undefined : 'muted'}>{value ? describeReminder(value, zone) : 'Add a reminder'}</span>
        </button>
        {value && (
          <button type="button" className="icon-button" onClick={() => onChange(null)} aria-label="Remove reminder" title="Remove reminder">
            <IoClose aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="reminder-editor">
          <span className="caption">Quick</span>
          <div className="reminder-presets">
            {reminderPresets(zone, itemHasTime && !isNote).map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip-button"
                onClick={() => {
                  onChange(p.reminder)
                  setOpen(false)
                }}>
                {p.label}
              </button>
            ))}
          </div>

          <span className="caption">Or set up</span>
          <div className="segmented small" role="radiogroup" aria-label="Repeat">
            {kinds.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={value?.kind === k.kind}
                className={value?.kind === k.kind ? 'active' : undefined}
                onClick={() => onChange(reminderOfKind(k.kind, value, zone))}>
                {k.label}
              </button>
            ))}
          </div>

          {value?.kind === 'At' && (
            <div className="form-row">
              <label>
                Date
                <input
                  type="date"
                  value={value.atUtc ? dateKey(value.atUtc, zone.timeZone) : ''}
                  onChange={(e) =>
                    e.target.value &&
                    onChange({ ...value, atUtc: zonedToUtc(e.target.value, value.atUtc ? timeKey(value.atUtc, zone.timeZone) : '09:00', zone.timeZone) })
                  }
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={value.atUtc ? timeKey(value.atUtc, zone.timeZone) : ''}
                  onChange={(e) =>
                    e.target.value &&
                    value.atUtc &&
                    onChange({ ...value, atUtc: zonedToUtc(dateKey(value.atUtc, zone.timeZone), e.target.value, zone.timeZone) })
                  }
                />
              </label>
            </div>
          )}

          {value?.kind === 'Before' && (
            <label>
              When
              <select value={value.minutesBefore ?? 0} onChange={(e) => onChange({ ...value, minutesBefore: Number(e.target.value) })}>
                {[...new Set([...BEFORE_CHOICES, value.minutesBefore ?? 0])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {minutesBeforeLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {value?.kind === 'Weekly' && (
            <div className="weekday-toggles" role="group" aria-label="Days">
              {WEEKDAYS.map((day) => {
                const on = !!value.days?.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    className={on ? 'active' : undefined}
                    onClick={() => onChange({ ...value, days: on ? value.days!.filter((d) => d !== day) : [...(value.days ?? []), day] })}>
                    {day.slice(0, 2)}
                  </button>
                )
              })}
            </div>
          )}

          {(value?.kind === 'Daily' || value?.kind === 'Weekdays' || value?.kind === 'Weekly') && (
            <label>
              Time
              <input type="time" value={value.time ?? ''} onChange={(e) => onChange({ ...value, time: e.target.value || null })} />
            </label>
          )}

          {value && repeats(value) && <p className="muted small">Repeats until you turn it off.</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
      {showProblem && problem && <p className="error">{problem}</p>}
    </div>
  )
}
