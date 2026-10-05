import { useSyncExternalStore } from 'react'

/**
 * Phone-width web: the app behaves like the mobile app (floating capture dock,
 * long-press, pull to refresh). By width, not by device - a narrow desktop
 * window gets the same.
 */
export const PHONE_QUERY = '(max-width: 700px)'

const query = typeof window !== 'undefined' ? window.matchMedia(PHONE_QUERY) : null
const subscribe = (onChange: () => void) => {
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

export const useIsPhone = () => useSyncExternalStore(subscribe, () => query?.matches ?? false)

/** A touch screen (long-press and pull to refresh only make sense there). */
export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
