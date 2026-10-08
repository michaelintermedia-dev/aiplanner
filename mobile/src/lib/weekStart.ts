import { firstDayOfWeek, setFirstDayOfWeek } from '@shared/calendar'
import { useQuery } from '@tanstack/react-query'
import { File, Paths } from 'expo-file-system'
import { useEffect, useSyncExternalStore } from 'react'
import { settingsApi } from '@/api/endpoints'

/**
 * Settings - Calendar - First day of week on the phone (same as the web's):
 * kept on the account, and in a small file so the calendar starts right.
 * Screens that lay out weeks (the calendar, the day chips) re-render when it changes.
 */
const file = () => new File(Paths.document, 'first-day-of-week.txt')
try {
  const f = file()
  if (f.exists) setFirstDayOfWeek(f.textSync().trim())
} catch {
  // not kept
}
const listeners = new Set<() => void>()

export function changeFirstDayOfWeek(day: string) {
  if (day === firstDayOfWeek()) return
  setFirstDayOfWeek(day)
  try {
    const f = file()
    if (!f.exists) f.create()
    f.write(firstDayOfWeek())
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
