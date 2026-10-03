import type { ItemDraft } from '@shared/captureDraft'

/**
 * Edits made in a capture review, kept in this browser until Save / Cancel -
 * leaving the page and pressing Resume brings them back (restoreDrafts checks
 * they still fit). Storage can be unavailable; then edits just aren't kept.
 */
const key = (captureId: string) => `review-draft:${captureId}`

export const reviewDrafts = {
  load(captureId: string): unknown {
    try {
      const saved = localStorage.getItem(key(captureId))
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  },
  save(captureId: string, drafts: ItemDraft[]) {
    try {
      localStorage.setItem(key(captureId), JSON.stringify(drafts))
    } catch {
      // not kept
    }
  },
  clear(captureId: string) {
    try {
      localStorage.removeItem(key(captureId))
    } catch {
      // nothing to clear
    }
  },
}
