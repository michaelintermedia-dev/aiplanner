import { t } from '@shared/i18n'
import { addTypedTags, newTagName, tagChoices, tagSuggestions, toggleTag } from '@shared/tags'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { IoAdd, IoClose } from 'react-icons/io5'
import { feedApi } from '../api/endpoints'

/**
 * An item's tags (redone at the user's request, 2026-10-12 - the old picker
 * showed every tag ever used): the item's tags as chips with an x, one "Add a
 * tag" box that suggests the most used tags, then - while typing - the
 * matching ones and "Create ..." for a new name; "All tags" opens the whole
 * list when wanted. Same as the app's TagPicker.
 */
export function TagPicker({ value, onChange, changed }: { value: string[]; onChange: (tags: string[]) => void; changed?: boolean }) {
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const known = tags.data?.map((x) => x.name) ?? []
  const [typed, setTyped] = useState('')
  const [all, setAll] = useState(false)
  const suggestions = tagSuggestions(known, value, typed)
  const create = newTagName(known, value, typed)
  const others = tagChoices(known, value).filter((n) => !value.includes(n))

  const add = (text = typed) => {
    if (!text.trim()) return
    onChange(addTypedTags(value, text, known))
    setTyped('')
  }
  // Suggestion buttons: mousedown would blur the box first (which adds the half-typed text).
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className={`tag-picker field${changed ? ' changed' : ''}`} title={changed ? t('form.changedByAi') : undefined}>
      <span className="field-label">{t('task.tags')}</span>
      {value.length > 0 && (
        <div className="tag-chips" role="list" aria-label={t('task.tags')}>
          {value.map((name) => (
            <span key={name} className="tag-chip" role="listitem">
              #{name}
              <button type="button" onClick={() => onChange(toggleTag(value, name))} aria-label={t('tags.remove', { name })} title={t('tags.remove', { name })}>
                <IoClose aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <span className="tag-new">
        <input
          value={typed}
          placeholder={t('tags.placeholder')}
          aria-label={t('tags.placeholder')}
          maxLength={120}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault() // not the form's submit
              add()
            }
          }}
          onBlur={() => add()}
        />
        <button type="button" className="icon-button" onClick={() => add()} disabled={!typed.trim()} aria-label={t('tags.add')} title={t('tags.add')}>
          <IoAdd aria-hidden />
        </button>
      </span>
      {(suggestions.length > 0 || create) && (
        <div className="tag-suggestions" role="group" aria-label={t('tags.suggestions')}>
          {suggestions.map((name) => (
            <button key={name} type="button" className="chip-button" onMouseDown={keepFocus} onClick={() => add(name)}>
              #{name}
            </button>
          ))}
          {create && (
            <button type="button" className="chip-button tag-create" onMouseDown={keepFocus} onClick={() => add(create)}>
              <IoAdd aria-hidden /> {t('tags.create', { name: create })}
            </button>
          )}
        </div>
      )}
      {!typed && others.length > suggestions.length && (
        <>
          <button type="button" className="link tag-all" onClick={() => setAll((a) => !a)} aria-expanded={all}>
            {all ? t('tags.fewer') : t('tags.all', { count: others.length })}
          </button>
          {all && (
            <div className="tag-suggestions tag-all-list">
              {others.map((name) => (
                <button key={name} type="button" className="chip-button" onClick={() => add(name)}>
                  #{name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
