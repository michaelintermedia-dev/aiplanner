import { ITEM_TYPES, KIND_LABEL } from '@shared/feed'
import type { ItemType } from '@shared/types'
import { useNavigate } from 'react-router'
import { itemsApi } from '../api/endpoints'
import { useAction } from '../lib/useAction'
import { itemPath } from '../lib/notifications'
import { KindIcon } from './KindIcon'

/** What a change of type loses, said before doing it. */
const LOSES: Partial<Record<`${ItemType}>${ItemType}`, string>> = {
  'Task>Note': 'Its due date, priority and tags won’t carry over.',
  'Task>Appointment': 'Its priority and tags won’t carry over.',
  'Appointment>Note': 'Its time won’t carry over (the location goes into the text).',
}

/**
 * "Change type": any item can become a task, an event or a note (same on
 * mobile). The old item is replaced by the new one; if something had to be
 * guessed (an event's time), the new item opens for editing.
 */
export function ChangeType({ itemType, id }: { itemType: ItemType; id: string }) {
  const navigate = useNavigate()
  const convert = useAction(itemsApi.convert, { forget: ({ fromType, id: oldId }) => [fromType.toLowerCase(), oldId] })

  const changeTo = (toType: ItemType) => {
    const warning = LOSES[`${itemType}>${toType}`]
    if (!window.confirm(`Change this ${KIND_LABEL[itemType].toLowerCase()} to ${toType === 'Appointment' ? 'an event' : `a ${KIND_LABEL[toType].toLowerCase()}`}?${warning ? `\n\n${warning}` : ''}`)) return
    convert.mutate(
      { fromType: itemType, id, toType },
      { onSuccess: (item) => navigate(`${itemPath({ itemType: item.itemType, itemId: item.id })}${item.needsDetails ? '?edit=1' : ''}`, { replace: true }) },
    )
  }

  return (
    <div className="change-type">
      <span className="muted small">Type</span>
      <div className="segmented small" role="radiogroup" aria-label="Change type">
        {ITEM_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === itemType}
            className={t === itemType ? 'active' : undefined}
            disabled={convert.isPending}
            onClick={() => t !== itemType && changeTo(t)}>
            <KindIcon kind={t} /> {KIND_LABEL[t]}
          </button>
        ))}
      </div>
      {convert.error && <p className="error">{convert.error.message}</p>}
    </div>
  )
}
