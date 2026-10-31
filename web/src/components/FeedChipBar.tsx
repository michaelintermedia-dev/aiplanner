import {
  clearSheetFilters,
  CREATED_OPTIONS,
  filterChips,
  filterTagsShown,
  HAS_OPTIONS,
  ORIGIN_OPTIONS,
  REMINDER_OPTIONS,
  sheetFilterCount,
  SHOW_OPTIONS,
  STATUS_OPTIONS,
  TOGGLES,
  WHEN_OPTIONS,
  type FeedFilters,
} from '@shared/feedFilter'
import { DEFAULT_ORDER, ORDER_OPTIONS, type OrderSetting } from '@shared/feedOrder'
import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IoCheckmarkCircleOutline, IoClose, IoOptionsOutline, IoSearch } from 'react-icons/io5'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { SearchMic } from './SearchMic'

/**
 * Above the feed (spec v2, same as the app): the search box with its mic, ONE
 * row of chips - the type (All / Tasks / Events / Notes, one at a time), the
 * toggles Open / Today / With media, and ⚙ (the sheet with every other filter
 * and the order; its badge counts what it set) - then those extra filters as
 * removable chips.
 */
export function FeedChipBar({
  filters,
  onChange,
  order,
  onOrder,
  onSelect,
  canSelect,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  order: OrderSetting
  onOrder: (o: OrderSetting) => void
  /** "Select items" in the sheet (delete several). */
  onSelect: () => void
  canSelect: boolean
}) {
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const chips = filterChips(filters, zone.locale)
  const extra = sheetFilterCount(filters) + (order.order !== 'Smart' || order.priorityFirst ? 1 : 0)

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
        <SearchMic
          onText={(text) => {
            setMicError(null)
            onChange({ ...filters, text })
          }}
          onError={setMicError}
        />
      </label>
      {micError && <p className="error">{micError}</p>}

      <div className="chip-bar" role="toolbar" aria-label={t('feed.show')}>
        {SHOW_OPTIONS.map((o) => {
          const on = filters.show === o.value
          return (
            <button
              key={o.value}
              type="button"
              className={`chip bar-chip${on ? ' active' : ''}`}
              aria-pressed={on}
              onClick={() => {
                onChange({ ...filters, show: o.value })
                window.scrollTo({ top: 0 })
              }}>
              {o.label}
            </button>
          )
        })}
        <span className="chip-divider" aria-hidden />
        {TOGGLES.map((x) => {
          const on = x.on(filters)
          return (
            <button key={x.id} type="button" className={`chip bar-chip toggle${on ? ' active' : ''}`} aria-pressed={on} onClick={() => onChange(x.flip(filters))}>
              {x.label}
            </button>
          )
        })}
        <button
          type="button"
          className={`chip bar-chip sheet-button${extra ? ' set' : ''}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={extra ? `${t('filter.sheet')} · ${extra}` : t('filter.sheet')}
          title={t('filter.sheet')}>
          <IoOptionsOutline aria-hidden />
          {extra > 0 && <span className="chip-badge">{extra}</span>}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip filter-chip" onClick={() => onChange(c.clear(filters))} aria-label={t('filter.remove', { label: c.label })}>
              {c.label} <IoClose aria-hidden />
            </button>
          ))}
          <button type="button" className="link" onClick={() => onChange(clearSheetFilters(filters))}>
            {t('filter.clearAll')}
          </button>
        </div>
      )}

      {open && (
        <FiltersSheet
          filters={filters}
          onChange={onChange}
          order={order}
          onOrder={onOrder}
          onClose={() => setOpen(false)}
          onSelect={
            canSelect
              ? () => {
                  setOpen(false)
                  onSelect()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

/**
 * The ⚙ sheet: the order, then what the item has, when, status, how it was made.
 * A bottom sheet on a phone, a dialog on a wide screen.
 */
function FiltersSheet({
  filters: f,
  onChange,
  order,
  onOrder,
  onClose,
  onSelect,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  order: OrderSetting
  onOrder: (o: OrderSetting) => void
  onClose: () => void
  onSelect?: () => void
}) {
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch })
  const [allTags, setAllTags] = useState(false)
  const usedCount = tags.data?.filter((tag) => tag.count > 0 || f.tags.includes(tag.name)).length ?? 0
  const usedTags = filterTagsShown(tags.data ?? [], f.tags, allTags)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // On the page body: a frosted panel around the feed would box the fixed sheet in.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet filter-panel" role="dialog" aria-modal="true" aria-label={t('filter.sheet')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('filter.sheet')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('common.close')}>
            <IoClose aria-hidden />
          </button>
        </div>

        <Group title={t('feed.order')}>
          <Options label={t('feed.order')} options={ORDER_OPTIONS} value={order.order} onChange={(value) => onOrder({ ...order, order: value })} />
          <div className="reminder-presets">
            <button
              type="button"
              className={`chip-button${order.priorityFirst ? ' selected' : ''}`}
              aria-pressed={order.priorityFirst}
              onClick={() => onOrder({ ...order, priorityFirst: !order.priorityFirst })}>
              {t('feed.sort.priority')}
            </button>
          </div>
        </Group>

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

        <div className="form-actions sheet-actions">
          {onSelect && (
            <button type="button" onClick={onSelect}>
              <IoCheckmarkCircleOutline aria-hidden /> {t('select.start')}
            </button>
          )}
          <button type="button" className="link" onClick={() => (onChange(clearSheetFilters(f)), onOrder(DEFAULT_ORDER))}>
            {t('filter.clearAll')}
          </button>
          <button type="button" className="primary" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
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
