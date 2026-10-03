import { parseSpeed, SPEED_KEY, type Speed } from '@shared/playbackSpeed'
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

/** The playback speed, shared by every player and kept on the phone. */
let current: Speed = 1
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

SecureStore.getItemAsync(SPEED_KEY)
  .then((value) => {
    current = parseSpeed(value)
    notify()
  })
  .catch(() => {})

export function setPlaybackSpeed(speed: Speed) {
  current = speed
  notify()
  SecureStore.setItemAsync(SPEED_KEY, String(speed)).catch(() => {})
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
