import { DEFAULT_SORT_CHIPS, parseSortChips, SORT_CHIPS_KEY, type SortChip } from '@shared/sortCriteria'
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

/**
 * The feed's sort chips, shared by all the tabs and kept on the phone (like
 * the web app keeps them in the browser).
 */
let current: SortChip[] = DEFAULT_SORT_CHIPS
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

// Load what was saved; until then the defaults show.
SecureStore.getItemAsync(SORT_CHIPS_KEY)
  .then((json) => {
    if (json) {
      current = parseSortChips(json)
      notify()
    }
  })
  .catch(() => {})

export function setSortChips(next: SortChip[]) {
  current = next
  notify()
  SecureStore.setItemAsync(SORT_CHIPS_KEY, JSON.stringify(next)).catch(() => {})
}

export function useSortChips(): [SortChip[], (chips: SortChip[]) => void] {
  const chips = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  return [chips, setSortChips]
}
