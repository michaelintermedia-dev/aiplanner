import {
  CREATED_OPTIONS,
  filterChips,
  filterTagsShown,
  HAS_OPTIONS,
  ORIGIN_OPTIONS,
  REMINDER_OPTIONS,
  STATUS_OPTIONS,
  WHEN_OPTIONS,
  NO_FILTERS,
  type FeedFilters,
} from '@shared/feedFilter'
import { QUICK_VIEWS, toggleView, viewLabel, type QuickView, type QuickViewId } from '@shared/feedViews'
import { useQuery } from '@tanstack/react-query'
import { useState, type ComponentType, type ReactNode } from 'react'
import {
  IoAlertCircleOutline,
  IoCalendarOutline,
  IoCheckmarkDoneOutline,
  IoClose,
  IoCreateOutline,
  IoFunnelOutline,
  IoImageOutline,
  IoMicOutline,
  IoSearch,
  IoSquareOutline,
  IoTodayOutline,
} from 'react-icons/io5'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { t } from '@shared/i18n'

/** Same icons as the mobile app's quick views. */
const VIEW_ICON: Record<QuickViewId, ComponentType> = {
  today: IoTodayOutline,
  upcoming: IoCalendarOutline,
  overdue: IoAlertCircleOutline,
  openTasks: IoSquareOutline,
  done: IoCheckmarkDoneOutline,
  photos: IoImageOutline,
  voice: IoMicOutline,
  changed: IoCreateOutline,
}

/**
 * Above the feed (same as the mobile app): the search box, the quick views
 * (one tap = a common question with its own order), the Filter button + panel
 * and the active filters as removable chips. They apply to whichever tab is showing.
 */
export function FeedFilterBar({
  filters,
  onChange,
  onView,
  sortChip,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  /** A quick view was tapped (the page may switch tabs for it). */
  onView: (view: QuickView, next: FeedFilters) => void
  sortChip: ReactNode
}) {
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  // The search box shows the text; a quick view's chip shows what it set.
  const chips = filterChips(filters, zone.locale).filter((c) => c.key !== 'text')
  const shownChips = filters.view ? [] : chips

  return (
    <div className="feed-filters">
      <label className="filter-search feed-search">
        <IoSearch aria-hidden />
        <input
          type="search"
          value={filters.text}
          onChange={(e) => onChange({ ...filters, text: e.target.value })}
          placeholder={t('filter.searchPlaceholder')}
          aria-label={t('filter.search')}
        />
        {filters.text && (
          <button type="button" className="icon-button" onClick={() => onChange({ ...filters, text: '' })} aria-label={t('filter.searchClear')}>
            <IoClose aria-hidden />
          </button>
        )}
      </label>

      <div className="quick-views" role="group" aria-label={t('view.label')}>
        {QUICK_VIEWS.map((v) => {
          const Icon = VIEW_ICON[v.id]
          const on = filters.view === v.id
          return (
            <button key={v.id} type="button" className={`chip quick-view${on ? ' active' : ''}`} aria-pressed={on} onClick={() => onView(v, toggleView(filters, v))}>
              <Icon aria-hidden /> {viewLabel(v)}
            </button>
          )
        })}
      </div>

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

      {shownChips.length > 0 && (
        <div className="filter-chips">
          {shownChips.map((c) => (
            <button key={c.key} type="button" className="chip filter-chip" onClick={() => onChange(c.clear(filters))} aria-label={t('filter.remove', { label: c.label })}>
              {c.label} <IoClose aria-hidden />
            </button>
          ))}
          <button type="button" className="link" onClick={() => onChange({ ...NO_FILTERS, text: filters.text })}>
            {t('filter.clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Grouped like the mobile app: What it is / has, When, Status, Where it came from. */
function FilterPanel({ filters: f, onChange, onClose }: { filters: FeedFilters; onChange: (f: FeedFilters) => void; onClose: () => void }) {
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  // A change by hand ends the quick view (and its own order).
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch, view: null, sort: null })
  const [allTags, setAllTags] = useState(false)
  const usedCount = tags.data?.filter((tag) => tag.count > 0 || f.tags.includes(tag.name)).length ?? 0
  const usedTags = filterTagsShown(tags.data ?? [], f.tags, allTags)

  return (
    <section className="card filter-panel" aria-label={t('filter.panel')}>
      <Group title={t('filter.group.what')}>
        <div className="reminder-presets">
          {HAS_OPTIONS.map((o) => {
            const on = f.has.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                className={`chip-button${on ? ' selected' : ''}`}
                aria-pressed={on}
                onClick={() => set({ has: on ? f.has.filter((x) => x !== o.value) : [...f.has, o.value] })}>
                {o.label}
              </button>
            )
          })}
        </div>
        {usedTags.length > 0 && (
          <div className="reminder-presets" aria-label={t('filter.tags')}>
            {usedTags.map((tag) => {
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
            {usedCount > usedTags.length || allTags ? (
              <button type="button" className="link" onClick={() => setAllTags((a) => !a)}>
                {allTags ? t('tags.fewer') : t('tags.all', { count: usedCount })}
              </button>
            ) : null}
          </div>
        )}
      </Group>

      <Group title={t('filter.group.when')}>
        <Options label={t('filter.when')} options={WHEN_OPTIONS} value={f.when} onChange={(when) => set({ when })} />
      </Group>

      <Group title={t('filter.group.status')}>
        <Options label={t('filter.status')} options={STATUS_OPTIONS} value={f.status} onChange={(status) => set({ status })} />
        <Options caption label={t('filter.reminders')} options={REMINDER_OPTIONS} value={f.reminders} onChange={(reminders) => set({ reminders })} />
      </Group>

      <Group title={t('filter.group.origin')}>
        <Options label={t('filter.group.origin')} options={ORIGIN_OPTIONS} value={f.origin} onChange={(origin) => set({ origin })} />
        <Options caption label={t('filter.created')} options={CREATED_OPTIONS} value={f.created} onChange={(created) => set({ created })} />
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
      </Group>

      <div className="form-actions">
        <button type="button" className="primary" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-group">
      <span className="caption">{title}</span>
      {children}
    </div>
  )
}

function Options<T extends string>({ label, caption, options, value, onChange }: { label: string; caption?: boolean; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="reminder-presets" role="radiogroup" aria-label={label}>
      {caption && <span className="sub-caption">{label}</span>}
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
  )
}
