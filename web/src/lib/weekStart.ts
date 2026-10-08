import { firstDayOfWeek, setFirstDayOfWeek } from '@shared/calendar'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { settingsApi } from '../api/endpoints'

/**
 * Settings - Calendar - First day of week on the web: kept on the account,
 * and on this device so the calendar starts right after a reload. Screens that
 * lay out weeks (the calendar, the day chips) re-render when it changes.
 */
const KEY = 'firstDayOfWeek'
try {
  setFirstDayOfWeek(localStorage.getItem(KEY))
} catch {
  // not kept
}
const listeners = new Set<() => void>()

export function changeFirstDayOfWeek(day: string) {
  if (day === firstDayOfWeek()) return
  setFirstDayOfWeek(day)
  try {
    localStorage.setItem(KEY, firstDayOfWeek())
  } catch {
    // not kept
  }
  listeners.forEach((l) => l())
}

export function useFirstDayOfWeek() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    firstDayOfWeek,
  )
}

/** Signed in: the account's first day of week. */
export function useAccountFirstDayOfWeek() {
  const { data } = useQuery({ queryKey: ['settings', 'calendar'], queryFn: settingsApi.calendar })
  useEffect(() => {
    if (data) changeFirstDayOfWeek(data.firstDayOfWeek)
  }, [data])
}
