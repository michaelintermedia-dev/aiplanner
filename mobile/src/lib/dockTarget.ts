import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * What the floating mic does depends on the screen (user's call, 2026-10-05):
 * on an item's screen it means "talk about this item" - the screen registers
 * itself here while it's focused, and the dock calls `onTalk` instead of
 * opening the new-entry toolbar. Everywhere else it's a new entry.
 */
export interface DockTarget {
  /** What tapping does, for screen readers ("Talk about it"). */
  label: string
  onTalk: () => void
}

let current: DockTarget | null = null
let opener: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** The item screen's registration: active while the screen is focused. */
export function useDockTarget(target: DockTarget | null) {
  // The latest callback, without re-registering on every render.
  const latest = useRef(target)
  useEffect(() => {
    latest.current = target
  })
  const label = target?.label ?? null
  useFocusEffect(
    useCallback(() => {
      if (!label) return
      const mine: DockTarget = { label, onTalk: () => latest.current?.onTalk() }
      current = mine
      emit()
      return () => {
        if (current === mine) current = null
        emit()
      }
    }, [label]),
  )
}

/** Called whenever an item screen comes into view or leaves (the dock collapses for one). */
export function onDockTargetChange(listener: (target: DockTarget | null) => void) {
  return subscribe(() => listener(current))
}

/** The dock's side: what the floating mic does right now (null = new entry). */
export const useCurrentDockTarget = () => useSyncExternalStore(subscribe, () => current)

/** The dock registers how to open its new-entry toolbar ("New entry instead"). */
export function setDockOpener(open: (() => void) | null) {
  opener = open
}

export const openDock = () => opener?.()
