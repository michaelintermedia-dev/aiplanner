import { DEFAULT_APPEARANCE, SKIN_NAMES, THEMES, type AppearanceSettings } from '@shared/appearance'
import { useQuery } from '@tanstack/react-query'
import { File, Paths } from 'expo-file-system'
import { useEffect, useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import { settingsApi } from '@/api/endpoints'

/**
 * Settings - Appearance on the phone (same as the web's): the theme is applied
 * app-wide through React Native's Appearance (so the system's own dialogs and
 * pickers follow it too), the skin through useColors(), the wallpaper by
 * <Wallpaper>. The last settings are kept in a small file, read at start-up so
 * the app opens in the right colours; the account's win once loaded.
 */
const file = () => new File(Paths.document, 'appearance.json')

function load(): AppearanceSettings {
  try {
    const f = file()
    if (!f.exists) return DEFAULT_APPEARANCE
    const stored = JSON.parse(f.textSync()) as Partial<AppearanceSettings>
    if (THEMES.includes(stored.theme!) && SKIN_NAMES.includes(stored.skin!)) return { ...DEFAULT_APPEARANCE, ...stored }
  } catch {
    // not kept
  }
  return DEFAULT_APPEARANCE
}

let current = load()
const listeners = new Set<() => void>()
const forceScheme = (theme: AppearanceSettings['theme']) =>
  Appearance.setColorScheme(theme === 'Light' ? 'light' : theme === 'Dark' ? 'dark' : 'unspecified')
forceScheme(current.theme)

export function applyAppearance(settings: AppearanceSettings) {
  if (JSON.stringify(settings) === JSON.stringify(current)) return
  current = settings
  forceScheme(settings.theme)
  try {
    const f = file()
    if (!f.exists) f.create()
    f.write(JSON.stringify(settings))
  } catch {
    // not kept
  }
  listeners.forEach((l) => l())
}

export function useAppearance(): AppearanceSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

/** Signed in: the account's appearance (it follows the user to every device). */
export function useAccountAppearance() {
  const { data } = useQuery({ queryKey: ['settings', 'appearance'], queryFn: settingsApi.appearance })
  useEffect(() => {
    if (data) applyAppearance(data)
  }, [data])
}
