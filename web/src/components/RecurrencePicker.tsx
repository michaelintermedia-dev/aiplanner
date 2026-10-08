import { describeRecurrence, presetLabel, presetOf, presetRule, REPEAT_PRESETS, weekdayOf, type RepeatPreset } from '@shared/recurrence'
import { shortDay } from '@shared/reminders'
import { weekdaysInOrder } from '@shared/calendar'
import { t } from '@shared/i18n'
import type { Recurrence } from '@shared/types'
import { useState } from 'react'
import { IoRepeat } from 'react-icons/io5'
import { useAuth } from '../auth/useAuth'
import { useFirstDayOfWeek } from '../lib/weekStart'

const CUSTOM = 'Custom'

/**
 * How a task or event repeats: quick choices that use the item's own date
 * ("Every Monday", "Every month on day 5"), or Custom - every N
 * days/weeks/months, which days, and when it ends. Same as the mobile app's.
 */
export function RecurrencePicker({
  value,
  onChange,
  date,
  disabled,
}: {
  value: Recurrence | null
  onChange: (value: Recurrence | null) => void
  /** The item's date ("yyyy-MM-dd") - the first occurrence; fills in the day. */
  date: string | null
  disabled?: boolean
}) {
  // Weeks are laid out from the chosen first day: re-render when it changes.
  useFirstDayOfWeek()
  const { zone } = useAuth()
  const preset = presetOf(value, date)
  const [custom, setCustom] = useState(preset === null)
  const editing = custom || preset === null

  const choose = (choice: string) => {
    if (choice === CUSTOM) {
      setCustom(true)
      // "Every weekday" spelled out (weekly on Mon-Fri), so the editor shows what it is.
      onChange(
        value?.frequency === 'Weekdays'
          ? { frequency: 'Weekly', interval: 1, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
          : (value ?? { frequency: 'Weekly', interval: 1, days: date ? [weekdayOf(date)] : null }),
      )
      return
    }
    setCustom(false)
    onChange(presetRule(choice as RepeatPreset, date))
  }

  return (
    <div className="recurrence-picker">
      <label>
        <span>
          <IoRepeat aria-hidden /> {t('repeat.label')}
        </span>
        <select value={editing ? CUSTOM : preset!} onChange={(e) => choose(e.target.value)} disabled={disabled}>
          {REPEAT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {presetLabel(p, date, zone)}
            </option>
          ))}
          <option value={CUSTOM}>{editing && value ? describeRecurrence(value, zone) : t('repeat.custom')}</option>
        </select>
      </label>
      {editing && value && <CustomRule value={value} onChange={onChange} />}
    </div>
  )
}

function CustomRule({ value, onChange }: { value: Recurrence; onChange: (value: Recurrence) => void }) {
  const { zone } = useAuth()
  const set = (patch: Partial<Recurrence>) => onChange({ ...value, ...patch })
  const n = Math.max(1, value.interval || 1)
  const ends = value.until ? 'date' : value.count ? 'count' : 'never'

  return (
    <div className="recurrence-custom">
      <div className="form-row">
        <label>
          {t('repeat.every')}
          <input type="number" min={1} max={99} value={n} onChange={(e) => set({ interval: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
        </label>
        <label>
          <span className="visually-hidden">{t('repeat.label')}</span>
          <select
            value={value.frequency === 'Weekdays' ? 'Daily' : value.frequency}
            onChange={(e) => set({ frequency: e.target.value as Recurrence['frequency'], days: value.days, monthDay: value.monthDay })}>
            <option value="Daily">{t('repeat.unitDay', { count: n })}</option>
            <option value="Weekly">{t('repeat.unitWeek', { count: n })}</option>
            <option value="Monthly">{t('repeat.unitMonth', { count: n })}</option>
          </select>
        </label>
      </div>
      {value.frequency === 'Weekly' && (
        <div className="day-chips" role="group" aria-label={t('repeat.onDays')}>
          {weekdaysInOrder().map((d) => {
            const on = value.days?.includes(d) ?? false
            return (
              <button
                key={d}
                type="button"
                className={`chip${on ? ' selected' : ''}`}
                aria-pressed={on}
                onClick={() => set({ days: on ? (value.days ?? []).filter((x) => x !== d) : [...(value.days ?? []), d] })}>
                {shortDay(d, zone.locale)}
              </button>
            )
          })}
        </div>
      )}
      {value.frequency === 'Monthly' && (
        <label>
          {t('repeat.onMonthDay')}
          <input type="number" min={1} max={31} value={value.monthDay ?? ''} onChange={(e) => set({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
        </label>
      )}
      <div className="form-row">
        <label>
          {t('repeat.ends')}
          <select
            value={ends}
            onChange={(e) =>
              set(
                e.target.value === 'date'
                  ? { until: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), count: null }
                  : e.target.value === 'count'
                    ? { count: 10, until: null }
                    : { until: null, count: null },
              )
            }>
            <option value="never">{t('repeat.never')}</option>
            <option value="date">{t('repeat.onDate')}</option>
            <option value="count">{t('repeat.after')}</option>
          </select>
        </label>
        {ends === 'date' && (
          <label>
            <span className="visually-hidden">{t('repeat.onDate')}</span>
            <input type="date" value={value.until ?? ''} onChange={(e) => set({ until: e.target.value || null })} />
          </label>
        )}
        {ends === 'count' && (
          <label>
            <span className="visually-hidden">{t('repeat.timesUnit')}</span>
            <input type="number" min={1} max={999} value={value.count ?? ''} onChange={(e) => set({ count: Math.min(999, Math.max(1, Number(e.target.value) || 1)) })} />
          </label>
        )}
      </div>
    </div>
  )
}
