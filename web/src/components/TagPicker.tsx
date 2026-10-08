import { t } from '@shared/i18n'
import { addTypedTags, hasTag, tagChoices, toggleTag } from '@shared/tags'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { IoAdd } from 'react-icons/io5'
import { feedApi } from '../api/endpoints'

/**
 * An item's tags: every tag the user has used is a chip to tap on or off
 * (several at once), and a box adds a new one - kept in the list for next
 * time once the item is saved. Same as the mobile app's TagPicker.
 */
export function TagPicker({ value, onChange, changed }: { value: string[]; onChange: (tags: string[]) => void; changed?: boolean }) {
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const known = tags.data?.map((x) => x.name) ?? []
  const [typed, setTyped] = useState('')
  const add = () => {
    if (!typed.trim()) return
    onChange(addTypedTags(value, typed, known))
    setTyped('')
  }

  return (
    <div className={`tag-picker field${changed ? ' changed' : ''}`} title={changed ? t('form.changedByAi') : undefined}>
      <span className="field-label">{t('task.tags')}</span>
      <div className="reminder-presets" role="group" aria-label={t('task.tags')}>
        {tagChoices(known, value).map((name) => {
          const on = hasTag(value, name)
          return (
            <button key={name} type="button" className={`chip-button${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => onChange(toggleTag(value, name))}>
              #{name}
            </button>
          )
        })}
        <span className="tag-new">
          <input
            value={typed}
            placeholder={t('tags.new')}
            aria-label={t('tags.new')}
            maxLength={120}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault() // not the form's submit
                add()
              }
            }}
            onBlur={add}
          />
          <button type="button" className="icon-button" onClick={add} disabled={!typed.trim()} aria-label={t('tags.add')} title={t('tags.add')}>
            <IoAdd aria-hidden />
          </button>
        </span>
      </div>
    </div>
  )
}
