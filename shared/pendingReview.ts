import { toConfirmItem, toDraft, type ItemDraft } from './captureDraft'
import type { Capture, CaptureSummary, ConfirmCaptureItem, ItemType } from './types'

/**
 * A review the user left without saving or cancelling (navigated away, reloaded,
 * closed the app) stays pending on the server. The capture bar offers it back:
 * "Unsaved review: ... · Resume · Discard" - nothing said is ever silently lost.
 */

/** How far back an unfinished review is offered again. */
export const PENDING_REVIEW_DAYS = 7

/** The newest capture with proposals still waiting for Save / Cancel, if recent. */
export function pickPendingReview(list: CaptureSummary[] | undefined, now = Date.now()): CaptureSummary | null {
  return pendingCaptures(list, now)[0] ?? null
}

/** Every recent capture with an unsaved review, newest first. */
export function pendingCaptures(list: CaptureSummary[] | undefined, now = Date.now()): CaptureSummary[] {
  const cutoff = now - PENDING_REVIEW_DAYS * 86400e3
  return (list ?? [])
    .filter((c) => c.pendingCount > 0 && new Date(c.createdAtUtc).getTime() >= cutoff)
    .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
}

/**
 * An unsaved "Add more" review: the saved item it adds to. Resuming it needs
 * that item (its title, and that it still exists).
 */
export function pendingTarget(capture: Capture): { itemType: ItemType; itemId: string } | null {
  const item = capture.items.find((i) => i.status === 'PendingReview' && i.continuesItemType && i.continuesItemId)
  return item ? { itemType: item.continuesItemType!, itemId: item.continuesItemId! } : null
}

/** Discard: reject every pending proposal, so the capture stops being pending. */
export const rejectPending = (capture: Capture, timeZone: string): ConfirmCaptureItem[] =>
  capture.items
    .filter((i) => i.status === 'PendingReview')
    .map((i) => toConfirmItem({ ...toDraft(i, timeZone), include: false }, timeZone))

/**
 * Edits made in a review are kept on the device until Save / Cancel, so
 * leaving and resuming doesn't lose them. Saved drafts are used only if they
 * are for exactly the same proposals.
 */
export function restoreDrafts(saved: unknown, fresh: ItemDraft[]): ItemDraft[] {
  if (!Array.isArray(saved) || saved.length !== fresh.length) return fresh
  const ids = new Set(fresh.map((d) => d.id))
  return saved.every((d) => d && typeof d === 'object' && ids.has((d as ItemDraft).id)) ? (saved as ItemDraft[]) : fresh
}
