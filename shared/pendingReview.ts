import { toConfirmItem, toDraft } from './captureDraft'
import type { Capture, CaptureSummary, ConfirmCaptureItem } from './types'

/**
 * A review the user left without saving or cancelling (navigated away, reloaded,
 * closed the app) stays pending on the server. The capture bar offers it back:
 * "Unsaved review: ... · Resume · Discard" - nothing said is ever silently lost.
 */

/** How far back an unfinished review is offered again. */
export const PENDING_REVIEW_DAYS = 7

/** The newest capture with proposals still waiting for Save / Cancel, if recent. */
export function pickPendingReview(list: CaptureSummary[] | undefined, now = Date.now()): CaptureSummary | null {
  const cutoff = now - PENDING_REVIEW_DAYS * 86400e3
  return (
    (list ?? [])
      .filter((c) => c.pendingCount > 0 && new Date(c.createdAtUtc).getTime() >= cutoff)
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))[0] ?? null
  )
}

/**
 * Whether it can be reopened as a normal review. Leftovers of "Add more" on an
 * item are proposals for that item, which the capture bar doesn't know - those
 * can only be discarded.
 */
export const canResume = (capture: Capture) => capture.items.some((i) => i.status === 'PendingReview' && !i.addsToCurrent)

/** Discard: reject every pending proposal, so the capture stops being pending. */
export const rejectPending = (capture: Capture, timeZone: string): ConfirmCaptureItem[] =>
  capture.items
    .filter((i) => i.status === 'PendingReview')
    .map((i) => toConfirmItem({ ...toDraft(i, timeZone), include: false }, timeZone))
