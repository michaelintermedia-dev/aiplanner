import { DEFAULT_APPEARANCE, SKIN_NAMES, THEMES, type AppearanceSettings } from '@shared/appearance'
import { useQuery } from '@tanstack/react-query'
import { File, Paths } from 'expo-file-system'
import { useEffect, useSyncExternalStore } from 'react'
import { Appearance, Platform } from 'react-native'
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
  void redrawWidget(settings)
}

/** Settings - Appearance as it is now (the home-screen widget draws itself from it). */
export const currentAppearance = () => current

/**
 * The home-screen widget follows the appearance: redrawn on every change (and
 * its photo thumbnail made first, while signed in). Android only.
 */
async function redrawWidget(settings: AppearanceSettings) {
  if (Platform.OS !== 'android') return
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- the widget code is Android-only */
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget')
    const { renderQuickRecord } = require('@/widgets/taskHandler') as typeof import('@/widgets/taskHandler')
    const { makeWidgetThumb } = require('@/widgets/widgetLook') as typeof import('@/widgets/widgetLook')
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (settings.wallpaper && settings.wallpaperPhoto) await makeWidgetThumb(settings.wallpaperPhoto)
    await requestWidgetUpdate({ widgetName: 'QuickRecord', renderWidget: () => renderQuickRecord() })
  } catch {
    // no widget on the home screen, or it couldn't be drawn - it redraws next time
  }
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

let widgetRefreshed = false

/** Signed in: the account's appearance (it follows the user to every device). */
export function useAccountAppearance() {
  const { data } = useQuery({ queryKey: ['settings', 'appearance'], queryFn: settingsApi.appearance })
  useEffect(() => {
    if (!data) return
    applyAppearance(data)
    // Once a session, even unchanged: a new app version, or a photo whose widget thumbnail isn't made yet.
    if (!widgetRefreshed) {
      widgetRefreshed = true
      void redrawWidget(data)
    }
  }, [data])
}
