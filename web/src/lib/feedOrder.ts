import { FEED_ORDER_KEY, parseOrder, type OrderSetting } from '@shared/feedOrder'
import { useSyncExternalStore } from 'react'

/** The feed's order (⚙ sheet), kept in this browser - same as the app keeps it on the phone. */
let current: OrderSetting = (() => {
  try {
    return parseOrder(localStorage.getItem(FEED_ORDER_KEY))
  } catch {
    return parseOrder(null)
  }
})()
const listeners = new Set<() => void>()

export function setFeedOrder(next: OrderSetting) {
  current = next
  try {
    localStorage.setItem(FEED_ORDER_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the choice just won't survive a reload.
  }
  listeners.forEach((l) => l())
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
