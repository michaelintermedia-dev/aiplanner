import { parseSpeed, SPEED_KEY, type Speed } from '@shared/playbackSpeed'
import { useSyncExternalStore } from 'react'

/** The playback speed, shared by every player and kept in this browser. */
let current: Speed = (() => {
  try {
    return parseSpeed(localStorage.getItem(SPEED_KEY))
  } catch {
    return 1
  }
})()
const listeners = new Set<() => void>()

export function setPlaybackSpeed(speed: Speed) {
  current = speed
  try {
    localStorage.setItem(SPEED_KEY, String(speed))
  } catch {
    // Storage blocked: it just won't be remembered.
  }
  listeners.forEach((l) => l())
}

export function usePlaybackSpeed(): [Speed, (s: Speed) => void] {
  const speed = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  return [speed, setPlaybackSpeed]
}

/** A ref callback that keeps an <audio> at the chosen speed (also after its src changes). */
export function speedRef(speed: number) {
  return (a: HTMLAudioElement | null) => {
    if (!a) return
    a.defaultPlaybackRate = speed
    a.playbackRate = speed
  }
}
