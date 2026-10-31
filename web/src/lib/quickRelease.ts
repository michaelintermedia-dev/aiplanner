/**
 * Holding the dock's bubble records; letting go sends it (Save), sliding away
 * first cancels it (spec v2, 2026-10-31). The bubble tells the capture bar here.
 */
type Listener = (cancel: boolean) => void
const listeners = new Set<Listener>()

export function releaseQuickRecording(cancel: boolean) {
  listeners.forEach((l) => l(cancel))
}

export function onQuickRelease(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
