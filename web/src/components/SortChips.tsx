import { t } from '@shared/i18n'
import { SORT_CRITERIA, sortLabel, sortShortLabel, type SortChip } from '@shared/sortCriteria'
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
 * The feed's sort criteria as round chips, one icon each (same as mobile). A
 * tap switches one off (muted, grey ring) or on again (green ring) and the
 * feed re-sorts. The ⇅ button opens the editor: which criteria to show.
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

/** Pick the criteria; nothing changes until Save. */
function SortEditor({ chips, onSave, onCancel }: { chips: SortChip[]; onSave: (chips: SortChip[]) => void; onCancel: () => void }) {
  // Every criterion, with the user's colour where they have one.
  const [draft, setDraft] = useState(() =>
    SORT_CRITERIA.map((k) => {
      const saved = chips.find((c) => c.sort === k.sort)
      return { sort: k.sort, picked: !!saved, on: saved?.on ?? true }
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
                <span className="sort-circle small">
                  <Icon aria-hidden />
                </span>
                {sortLabel(d.sort)}
              </label>
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
          onClick={() => onSave(picked.map(({ sort, on }) => ({ sort, on })))}>
          {t('common.save')}
        </button>
      </div>
    </section>
  )
}
