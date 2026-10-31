import { DEFAULT_ORDER, FEED_ORDER_KEY, parseOrder, type OrderSetting } from '@shared/feedOrder'
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

/** The feed's order (⚙ sheet), kept on the phone - like the web keeps it in the browser. */
let current: OrderSetting = DEFAULT_ORDER
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

// Load what was saved; until then the default (Smart) shows.
SecureStore.getItemAsync(FEED_ORDER_KEY)
  .then((json) => {
    if (json) {
      current = parseOrder(json)
      notify()
    }
  })
  .catch(() => {})

export function setFeedOrder(next: OrderSetting) {
  current = next
  notify()
  SecureStore.setItemAsync(FEED_ORDER_KEY, JSON.stringify(next)).catch(() => {})
}

export function useFeedOrder(): [OrderSetting, (o: OrderSetting) => void] {
  const order = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  return [order, setFeedOrder]
}
