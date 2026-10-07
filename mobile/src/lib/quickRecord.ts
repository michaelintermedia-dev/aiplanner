import { useSyncExternalStore } from 'react'

/**
 * "Quick recording" (the home-screen widget, aiplanner://record): asks the
 * floating capture toolbar to open and start recording. A counter, so every
 * request is a new signal (CaptureBar's talkSignal).
 */
let requests = 0
const listeners = new Set<() => void>()

export function requestQuickRecording() {
  requests += 1
  listeners.forEach((l) => l())
}

export function useQuickRecording(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => requests,
  )
}
