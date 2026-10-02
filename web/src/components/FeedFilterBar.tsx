import {
  CREATED_OPTIONS,
  filterChips,
  REMINDER_OPTIONS,
  STATUS_OPTIONS,
  WHEN_OPTIONS,
  NO_FILTERS,
  type FeedFilters,
} from '@shared/feedFilter'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { IoClose, IoFunnelOutline, IoSearch } from 'react-icons/io5'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

/**
 * Filter button + panel + active-filter chips above the feed (same as the
 * mobile app). The filters apply to whichever tab is showing.
 */
export function FeedFilterBar({ filters, onChange, sortChip }: { filters: FeedFilters; onChange: (f: FeedFilters) => void; sortChip: ReactNode }) {
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const chips = filterChips(filters, zone.locale)

  return (
    <div className="feed-filters">
      <div className="feed-tools">
        <button
          type="button"
          className={`chip filter-toggle${chips.length ? ' active' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}>
          <IoFunnelOutline aria-hidden /> Filter{chips.length ? ` · ${chips.length}` : ''}
        </button>
        {sortChip}
      </div>

      {open && <FilterPanel filters={filters} onChange={onChange} onClose={() => setOpen(false)} />}

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip filter-chip" onClick={() => onChange(c.clear(filters))} aria-label={`Remove filter ${c.label}`}>
              {c.label} <IoClose aria-hidden />
            </button>
          ))}
          <button type="button" className="link" onClick={() => onChange(NO_FILTERS)}>
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterPanel({ filters: f, onChange, onClose }: { filters: FeedFilters; onChange: (f: FeedFilters) => void; onClose: () => void }) {
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch })

  return (
    <section className="card filter-panel" aria-label="Filters">
      <label className="filter-search">
        <IoSearch aria-hidden />
        <input value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder="Search text, details, location, tags" autoFocus />
      </label>

      <Options label="Created" options={CREATED_OPTIONS} value={f.created} onChange={(created) => set({ created })} />
      {f.created === 'custom' && (
        <div className="form-row">
          <label>
            From
            <input type="date" value={f.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || null })} />
          </label>
          <label>
            To
            <input type="date" value={f.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || null })} />
          </label>
        </div>
      )}
      <Options label="When (due / starts)" options={WHEN_OPTIONS} value={f.when} onChange={(when) => set({ when })} />
      <Options label="Status" options={STATUS_OPTIONS} value={f.status} onChange={(status) => set({ status })} />
      <Options label="Reminders" options={REMINDER_OPTIONS} value={f.reminders} onChange={(reminders) => set({ reminders })} />

      <div className="filter-group">
        <span className="caption">More</span>
        <div className="reminder-presets">
          <button type="button" className={`chip-button${f.fromVoice ? ' selected' : ''}`} aria-pressed={f.fromVoice} onClick={() => set({ fromVoice: !f.fromVoice })}>
            From voice
          </button>
        </div>
      </div>

      {tags.data && tags.data.length > 0 && (
        <div className="filter-group">
          <span className="caption">Tags (tasks)</span>
          <div className="reminder-presets">
            {tags.data.map((t) => {
              const on = f.tags.includes(t.name)
              return (
                <button
                  key={t.name}
                  type="button"
                  className={`chip-button${on ? ' selected' : ''}`}
                  aria-pressed={on}
                  onClick={() => set({ tags: on ? f.tags.filter((x) => x !== t.name) : [...f.tags, t.name] })}>
                  #{t.name} <span className="muted">{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  )
}

function Options<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="filter-group">
      <span className="caption">{label}</span>
      <div className="reminder-presets" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`chip-button${value === o.value ? ' selected' : ''}`}
            onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
