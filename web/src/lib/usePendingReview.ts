import { noteName } from '@shared/feed'
import { PENDING_REVIEW_DAYS, pendingCaptures, pendingTarget, rejectPending } from '@shared/pendingReview'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { appointmentsApi, capturesApi, notesApi, tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from './useAction'

/** The title of the item an unsaved "Add more" review adds to (it throws if the item is gone). */
async function itemTitle(itemType: ItemType, id: string): Promise<string> {
  if (itemType === 'Task') return (await tasksApi.get(id)).title
  if (itemType === 'Appointment') return (await appointmentsApi.get(id)).title
  return noteName(await notesApi.get(id))
}

/**
 * A review left unfinished (navigated away, reloaded, app closed) - offered
 * back by the capture bar. `enabled`: only while the bar shows no review of
 * its own. Returns the newest such capture, the item it adds to (for an
 * unsaved "Add more"), whether it can be reopened, how many more are waiting,
 * Discard (this one) and Discard all.
 */
export function usePendingReview(enabled: boolean) {
  const { zone } = useAuth()
  const list = useQuery({ queryKey: ['captures', 'pending'], queryFn: () => capturesApi.list(50, PENDING_REVIEW_DAYS), enabled })
  const all = enabled ? pendingCaptures(list.data) : []
  const candidate = all[0] ?? null
  const full = useQuery({ queryKey: ['capture', candidate?.id], queryFn: () => capturesApi.get(candidate!.id), enabled: !!candidate })
  const capture = candidate && full.data?.id === candidate.id && full.data.items.some((i) => i.status === 'PendingReview') ? full.data : null
  const target = capture ? pendingTarget(capture) : null
  const title = useQuery({
    queryKey: ['pending-target', target?.itemType, target?.itemId],
    queryFn: () => itemTitle(target!.itemType, target!.itemId),
    enabled: !!target,
    retry: false,
  })
  const appendTarget: AppendTarget | undefined = target && title.data ? { ...target, title: title.data } : undefined
  const discard = useAction((c: Capture) => capturesApi.confirm(c.id, rejectPending(c, zone.timeZone)))
  const discardAll = useAction(() => capturesApi.discardPending())
  return {
    capture,
    appendTarget,
    // An addition to an item that no longer exists can only be discarded.
    resumable: !!capture && (!target || !!appendTarget),
    others: Math.max(0, all.length - 1),
    discard,
    discardAll,
  }
}
