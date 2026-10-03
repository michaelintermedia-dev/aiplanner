import { canResume, pickPendingReview, rejectPending } from '@shared/pendingReview'
import type { Capture } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from './useAction'

/**
 * A review left unfinished (navigated away, reloaded, app closed) - offered
 * back by the capture bar. `enabled`: only while the bar shows no review of
 * its own. Returns the capture, whether it can be reopened, and Discard.
 */
export function usePendingReview(enabled: boolean) {
  const { zone } = useAuth()
  const list = useQuery({ queryKey: ['captures', 'pending'], queryFn: () => capturesApi.list(10), enabled })
  const candidate = enabled ? pickPendingReview(list.data) : null
  const full = useQuery({ queryKey: ['capture', candidate?.id], queryFn: () => capturesApi.get(candidate!.id), enabled: !!candidate })
  const discard = useAction((capture: Capture) => capturesApi.confirm(capture.id, rejectPending(capture, zone.timeZone)))
  const capture = candidate && full.data?.id === candidate.id && full.data.items.some((i) => i.status === 'PendingReview') ? full.data : null
  return { capture, resumable: !!capture && canResume(capture), discard }
}
