import {
  DEFAULT_APPEARANCE,
  palette,
  schemeOf,
  SKIN_NAMES,
  THEMES,
  wallpaperCss,
  type AppearanceSettings,
  type Scheme,
} from '@shared/appearance'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { settingsApi } from '../api/endpoints'

/**
 * Settings - Appearance on the web: the colour tokens (index.css's --bg, --accent,
 * ...) are set from the shared palette, and the skin's wallpaper is the page's
 * background. The last settings are kept on this device, so a reload starts in
 * them; the account's (the server's) win once loaded.
 */
const KEY = 'appearance'
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

let current: AppearanceSettings = load()

function load(): AppearanceSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AppearanceSettings> | null
    if (stored && THEMES.includes(stored.theme!) && SKIN_NAMES.includes(stored.skin!)) return { ...DEFAULT_APPEARANCE, ...stored }
  } catch {
    // not kept
  }
  return DEFAULT_APPEARANCE
}

const VARS: Record<string, keyof ReturnType<typeof palette>> = {
  '--bg': 'bg',
  '--surface': 'surface',
  '--surface-2': 'surface2',
  '--border': 'border',
  '--text': 'text',
  '--muted': 'muted',
  '--accent': 'accent',
  '--accent-soft': 'accentSoft',
  '--accent-text': 'accentText',
  '--danger': 'danger',
  '--warn': 'warn',
  '--ok': 'ok',
  '--appointment': 'appointment',
  '--task': 'task',
}

/** Paints the page in these settings (and remembers them on this device). */
export function applyAppearance(settings: AppearanceSettings = current) {
  current = settings
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // not kept
  }
  const scheme: Scheme = schemeOf(settings.theme, darkQuery?.matches ? 'dark' : 'light')
  const colors = palette(scheme, settings.skin)
  const root = document.documentElement
  for (const [name, key] of Object.entries(VARS)) root.style.setProperty(name, colors[key])
  root.style.setProperty('--shadow', scheme === 'dark' ? 'none' : '0 1px 2px rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.04)')
  root.style.colorScheme = scheme
  root.dataset.scheme = scheme
  document.body.style.background = settings.wallpaper ? wallpaperCss(scheme, settings.skin) : colors.bg
  document.body.style.backgroundAttachment = 'fixed'
  // The browser's own bar (phones, the installed app).
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = colors.surface
}

// "System" follows the device switching between light and dark.
darkQuery?.addEventListener('change', () => current.theme === 'System' && applyAppearance())

/** Signed in: the account's appearance (it follows the user to every device). */
export function useAccountAppearance() {
  const { data } = useQuery({ queryKey: ['settings', 'appearance'], queryFn: settingsApi.appearance })
  useEffect(() => {
    if (data) applyAppearance(data)
  }, [data])
}

export const currentAppearance = () => current
