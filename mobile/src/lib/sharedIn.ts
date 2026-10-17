import { useSyncExternalStore } from 'react'
import type { PendingMedia } from './media'

/**
 * Something shared into Gatazee from another app (user's request,
 * 2026-10-12 - a YouTube link, a web page, a photo): ShareIntake puts it here,
 * the floating toolbar opens and its CaptureBar saves it as a new entry (the
 * smart Save - the review opens only when something is unclear).
 */
export interface SharedContent {
  /** A new number for every share, so the same text shared twice is still new. */
  id: number
  text: string
  files: PendingMedia[]
}

let current: SharedContent | null = null
let next = 1
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

export function offerShared(text: string, files: PendingMedia[]) {
  current = { id: next++, text, files }
  changed()
}

/** The bar took it: it won't be offered again. */
export function takeShared(id: number) {
  if (current?.id === id) {
    current = null
    changed()
  }
}

export function useSharedIn(): SharedContent | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
