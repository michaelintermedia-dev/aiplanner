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
import { t } from '@shared/i18n'

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
          <IoFunnelOutline aria-hidden /> {t('filter.button')}{chips.length ? ` · ${chips.length}` : ''}
        </button>
        {sortChip}
      </div>

      {open && <FilterPanel filters={filters} onChange={onChange} onClose={() => setOpen(false)} />}

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip filter-chip" onClick={() => onChange(c.clear(filters))} aria-label={t('filter.remove', { label: c.label })}>
              {c.label} <IoClose aria-hidden />
            </button>
          ))}
          <button type="button" className="link" onClick={() => onChange(NO_FILTERS)}>
            {t('filter.clearAll')}
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
    <section className="card filter-panel" aria-label={t('filter.panel')}>
      <label className="filter-search">
        <IoSearch aria-hidden />
        <input value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder={t('filter.searchPlaceholder')} autoFocus />
      </label>

      <Options label={t('filter.created')} options={CREATED_OPTIONS} value={f.created} onChange={(created) => set({ created })} />
      {f.created === 'custom' && (
        <div className="form-row">
          <label>
            {t('filter.from')}
            <input type="date" value={f.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || null })} />
          </label>
          <label>
            {t('filter.to')}
            <input type="date" value={f.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || null })} />
          </label>
        </div>
      )}
      <Options label={t('filter.when')} options={WHEN_OPTIONS} value={f.when} onChange={(when) => set({ when })} />
      <Options label={t('filter.status')} options={STATUS_OPTIONS} value={f.status} onChange={(status) => set({ status })} />
      <Options label={t('filter.reminders')} options={REMINDER_OPTIONS} value={f.reminders} onChange={(reminders) => set({ reminders })} />

      <div className="filter-group">
        <span className="caption">{t('filter.more')}</span>
        <div className="reminder-presets">
          <button type="button" className={`chip-button${f.fromVoice ? ' selected' : ''}`} aria-pressed={f.fromVoice} onClick={() => set({ fromVoice: !f.fromVoice })}>
            {t('filter.fromVoice')}
          </button>
        </div>
      </div>

      {tags.data && tags.data.length > 0 && (
        <div className="filter-group">
          <span className="caption">{t('filter.tags')}</span>
          <div className="reminder-presets">
            {tags.data.map((tag) => {
              const on = f.tags.includes(tag.name)
              return (
                <button
                  key={tag.name}
                  type="button"
                  className={`chip-button${on ? ' selected' : ''}`}
                  aria-pressed={on}
                  onClick={() => set({ tags: on ? f.tags.filter((x) => x !== tag.name) : [...f.tags, tag.name] })}>
                  #{tag.name} <span className="muted">{tag.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="primary" onClick={onClose}>
          {t('common.done')}
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
