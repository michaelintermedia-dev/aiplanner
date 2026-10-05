import { useFocusEffect } from 'expo-router'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * The floating new-entry dock steps aside on an item's screen (user's call,
 * 2026-10-05): that screen has its own mic next to Edit ("talk about this
 * item"), and two mics at once is too much. The screen registers here while
 * it's focused; the dock hides while any is (unless a recording is going on).
 */

let focused = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** An item screen: the dock hides while it's focused. */
export function useHideDock() {
  useFocusEffect(
    useCallback(() => {
      focused++
      emit()
      return () => {
        focused--
        emit()
      }
    }, []),
  )
}

/** The dock's side: whether an item screen is in view. */
export const useDockHidden = () => useSyncExternalStore(subscribe, () => focused > 0)
