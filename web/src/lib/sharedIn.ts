import { useSyncExternalStore } from 'react'

/**
 * Something shared into Gatazee from another app (user's request,
 * 2026-10-12): the installed web app is a share target (manifest share_target
 * -> /share), SharePage puts it here and the new-entry CaptureBar saves it
 * (the smart Save - the review opens only when something is unclear). Same
 * as the app's lib/sharedIn (the web gets text and links only).
 */
export interface SharedContent {
  id: number
  text: string
}

let current: SharedContent | null = null
let next = 1
let lastVisit: string | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

/** `visit`: the share page's visit (location key) - a second run of the same visit (React's dev double effects) is ignored. */
export function offerShared(text: string, visit: string) {
  if (visit === lastVisit) return
  lastVisit = visit
  current = { id: next++, text }
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

/** What a share target receives (title, text, url - any may be missing or repeat each other) as one message. */
export function sharedText(title: string | null, text: string | null, url: string | null): string {
  const parts: string[] = []
  for (const p of [title, text, url]) {
    const v = p?.trim()
    if (v && !parts.some((x) => x.includes(v))) parts.push(v)
  }
  return parts.join('\n')
}
