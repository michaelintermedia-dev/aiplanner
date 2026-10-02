import { ITEM_TYPES, KIND_LABEL } from '@shared/feed'
import { t, type MessageKey } from '@shared/i18n'
import type { ItemType } from '@shared/types'
import { useNavigate } from 'react-router'
import { itemsApi } from '../api/endpoints'
import { useAction } from '../lib/useAction'
import { itemPath } from '../lib/notifications'
import { KindIcon } from './KindIcon'

/** What a change of type loses, said before doing it. */
const LOSES: Partial<Record<`${ItemType}>${ItemType}`, MessageKey>> = {
  'Task>Note': 'changeType.loses.taskToNote',
  'Task>Appointment': 'changeType.loses.taskToEvent',
  'Appointment>Note': 'changeType.loses.eventToNote',
}

/** "Change this note to a task?" */
const CONFIRM: Record<ItemType, MessageKey> = { Task: 'changeType.toTask', Appointment: 'changeType.toEvent', Note: 'changeType.toNote' }

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
    if (!window.confirm(`${t(CONFIRM[toType])}${warning ? `\n\n${t(warning)}` : ''}`)) return
    convert.mutate(
      { fromType: itemType, id, toType },
      { onSuccess: (item) => navigate(`${itemPath({ itemType: item.itemType, itemId: item.id })}${item.needsDetails ? '?edit=1' : ''}`, { replace: true }) },
    )
  }

  return (
    <div className="change-type">
      <span className="muted small">{t('changeType.label')}</span>
      <div className="segmented small" role="radiogroup" aria-label={t('changeType.aria')}>
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
