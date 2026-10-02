import { t } from '@shared/i18n'
import { SORT_COLORS, SORT_CRITERIA, sortLabel, sortShortLabel, type SortChip } from '@shared/sortCriteria'
import type { FeedSort } from '@shared/types'
import { useState, type ComponentType } from 'react'
import { IoCalendarOutline, IoCreateOutline, IoFlag, IoHourglassOutline, IoSparklesOutline, IoSwapVertical } from 'react-icons/io5'

/** One icon per criterion (same as mobile). */
const SORT_ICON: Record<FeedSort, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  PriorityHigh: IoFlag,
  CreatedDesc: IoSparklesOutline,
  CreatedAsc: IoHourglassOutline,
  UpdatedDesc: IoCreateOutline,
  DateAsc: IoCalendarOutline,
}

/**
 * The feed's sort criteria as round coloured chips (same as mobile). A tap
 * switches one off (muted, grey ring) or on again (green ring) and the feed
 * re-sorts. The ⇅ button opens the editor: which criteria, and their colours.
 */
export function SortChips({ chips, onChange }: { chips: SortChip[]; onChange: (chips: SortChip[]) => void }) {
  const [editing, setEditing] = useState(false)
  const allOff = chips.every((c) => !c.on)

  return (
    <div className="sort-chips-area">
      <div className="sort-chips" role="group" aria-label={t('sort.edit')}>
        {chips.map((c) => {
          const Icon = SORT_ICON[c.sort]
          return (
            <button
              key={c.sort}
              type="button"
              className={`sort-chip${c.on ? ' on' : ' off'}`}
              style={{ '--chip': c.color } as React.CSSProperties}
              aria-pressed={c.on}
              title={sortLabel(c.sort)}
              aria-label={t(c.on ? 'sort.toggleOn' : 'sort.toggleOff', { label: sortLabel(c.sort) })}
              onClick={() => onChange(chips.map((x) => (x.sort === c.sort ? { ...x, on: !x.on } : x)))}>
              <span className="sort-circle">
                <Icon aria-hidden />
              </span>
              <span className="sort-chip-label">{sortShortLabel(c.sort)}</span>
            </button>
          )
        })}
        <button type="button" className="sort-chip edit" onClick={() => setEditing((e) => !e)} aria-expanded={editing} title={t('sort.edit')} aria-label={t('sort.edit')}>
          <span className="sort-circle">
            <IoSwapVertical aria-hidden />
          </span>
          <span className="sort-chip-label">{t('feed.sortBy')}</span>
        </button>
      </div>
      {allOff && <p className="muted small">{t('sort.allOff')}</p>}
      {editing && (
        <SortEditor
          chips={chips}
          onSave={(next) => {
            onChange(next)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

/** Pick criteria and a colour for each; nothing changes until Save. */
function SortEditor({ chips, onSave, onCancel }: { chips: SortChip[]; onSave: (chips: SortChip[]) => void; onCancel: () => void }) {
  // Every criterion, with the user's colour where they have one.
  const [draft, setDraft] = useState(() =>
    SORT_CRITERIA.map((k) => {
      const saved = chips.find((c) => c.sort === k.sort)
      return { sort: k.sort, color: saved?.color ?? k.color, picked: !!saved, on: saved?.on ?? true }
    }),
  )
  const set = (sort: FeedSort, patch: Partial<(typeof draft)[number]>) => setDraft((d) => d.map((x) => (x.sort === sort ? { ...x, ...patch } : x)))
  const picked = draft.filter((d) => d.picked)

  return (
    <section className="card sort-editor" aria-label={t('sort.edit')}>
      <h3>{t('sort.edit')}</h3>
      <p className="muted small">{t('sort.editHint')}</p>
      <ul className="sort-editor-list">
        {draft.map((d) => {
          const Icon = SORT_ICON[d.sort]
          return (
            <li key={d.sort} className={d.picked ? undefined : 'unpicked'}>
              <label className="sort-editor-pick">
                <input type="checkbox" checked={d.picked} onChange={(e) => set(d.sort, { picked: e.target.checked, on: true })} />
                <span className="sort-circle small" style={{ background: d.color }}>
                  <Icon aria-hidden />
                </span>
                {sortLabel(d.sort)}
              </label>
              <div className="sort-swatches" role="radiogroup" aria-label={t('sort.color', { label: sortLabel(d.sort) })}>
                {SORT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={d.color === color}
                    aria-label={color}
                    className={`swatch${d.color === color ? ' selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => set(d.sort, { color, picked: true })}
                  />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      {picked.length === 0 && <p className="error">{t('sort.pickOne')}</p>}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={picked.length === 0}
          onClick={() => onSave(picked.map(({ sort, color, on }) => ({ sort, color, on })))}>
          {t('common.save')}
        </button>
      </div>
    </section>
  )
}
