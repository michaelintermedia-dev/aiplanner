import { t } from './i18n'

/**
 * Settings - Appearance (web + mobile): light/dark and a skin - its accent
 * colours and its wallpaper. Kept on the account (GET/PUT
 * /settings/appearance), so every device follows; each device also remembers
 * the last one, so it starts in the right colours.
 */

export type Theme = 'System' | 'Light' | 'Dark'
export type Skin = 'Indigo' | 'Ocean' | 'Forest' | 'Sunset' | 'Rose' | 'Graphite'
export type Scheme = 'light' | 'dark'

export interface AppearanceSettings {
  theme: Theme
  skin: Skin
  /** Show the skin's wallpaper behind the content (off = a plain background). */
  wallpaper: boolean
}

export const DEFAULT_APPEARANCE: AppearanceSettings = { theme: 'System', skin: 'Indigo', wallpaper: true }

export const THEMES: Theme[] = ['System', 'Light', 'Dark']
export const SKIN_NAMES: Skin[] = ['Indigo', 'Ocean', 'Forest', 'Sunset', 'Rose', 'Graphite']

export const themeLabel = (theme: Theme) =>
  theme === 'System' ? t('theme.system') : theme === 'Light' ? t('theme.light') : t('theme.dark')

export const skinLabel = (skin: Skin) => t(`skin.${skin.toLowerCase()}` as 'skin.indigo')

/** Light or dark, given the setting and the device's own. */
export const schemeOf = (theme: Theme, device: Scheme | null | undefined): Scheme =>
  theme === 'Light' ? 'light' : theme === 'Dark' ? 'dark' : device === 'dark' ? 'dark' : 'light'

/** Everything that isn't the skin's (the same names as the apps' colour tokens). */
const BASE = {
  light: {
    bg: '#f6f6f4',
    surface: '#ffffff',
    surface2: '#f0f0ed',
    border: '#e3e3de',
    text: '#1d1d1b',
    muted: '#6f6f69',
    danger: '#c2413a',
    warn: '#b7791f',
    ok: '#2f855a',
    task: '#2f855a',
  },
  dark: {
    bg: '#121212',
    surface: '#1b1b1b',
    surface2: '#242424',
    border: '#2e2e2e',
    text: '#ececea',
    muted: '#9a9a94',
    danger: '#ef7a72',
    warn: '#e0b35a',
    ok: '#68c792',
    task: '#68c792',
  },
}

interface SkinColors {
  accent: string
  accentSoft: string
  accentText: string
  /** Three soft colours for the wallpaper (top left, right, bottom). */
  wallpaper: [string, string, string]
}

/** Each skin in light and dark. */
export const SKINS: Record<Skin, Record<Scheme, SkinColors>> = {
  Indigo: {
    light: { accent: '#4f5bd5', accentSoft: '#e8eafb', accentText: '#ffffff', wallpaper: ['#c9cdf6', '#e4d3f7', '#cfe3f8'] },
    dark: { accent: '#8b94f5', accentSoft: '#262a4d', accentText: '#121212', wallpaper: ['#262c63', '#3a2459', '#1b3150'] },
  },
  Ocean: {
    light: { accent: '#0e7490', accentSoft: '#dff3f8', accentText: '#ffffff', wallpaper: ['#bfe8f3', '#cfe9fb', '#c4f0e6'] },
    dark: { accent: '#4fc3dc', accentSoft: '#12343d', accentText: '#0b1d22', wallpaper: ['#0f3d4c', '#123350', '#0f3f39'] },
  },
  Forest: {
    light: { accent: '#2f7d4f', accentSoft: '#e3f2e8', accentText: '#ffffff', wallpaper: ['#cfe9d6', '#e3efc9', '#c8e6df'] },
    dark: { accent: '#6fcf97', accentSoft: '#173726', accentText: '#0d1f15', wallpaper: ['#173b26', '#2c3b17', '#123a33'] },
  },
  Sunset: {
    light: { accent: '#c2410c', accentSoft: '#fdeadf', accentText: '#ffffff', wallpaper: ['#fcd9c2', '#fbe3b8', '#f7cdd2'] },
    dark: { accent: '#fb923c', accentSoft: '#3e2414', accentText: '#1f1309', wallpaper: ['#4a2512', '#4a3412', '#481a26'] },
  },
  Rose: {
    light: { accent: '#be185d', accentSoft: '#fbe4ef', accentText: '#ffffff', wallpaper: ['#f8cfe1', '#ead2f6', '#fbd9d3'] },
    dark: { accent: '#f472b6', accentSoft: '#3d1a2c', accentText: '#1f0d17', wallpaper: ['#4d1834', '#3b1d4e', '#4a1f1c'] },
  },
  Graphite: {
    light: { accent: '#374151', accentSoft: '#e8e9ec', accentText: '#ffffff', wallpaper: ['#dcdfe4', '#e6e3dd', '#d6dde3'] },
    dark: { accent: '#cbd5e1', accentSoft: '#2a2f38', accentText: '#121212', wallpaper: ['#262b33', '#2e2b26', '#232a30'] },
  },
}

/** All colour tokens for a scheme and skin (the apps' `Colors`). */
export function palette(scheme: Scheme, skin: Skin) {
  const s = SKINS[skin][scheme]
  return { ...BASE[scheme], accent: s.accent, accentSoft: s.accentSoft, accentText: s.accentText, appointment: s.accent }
}

/**
 * The wallpaper: three large, soft colour glows on the page colour - CSS for
 * the web; the phone app shows the same, rendered to images
 * (tools/qa/wallpapers.cjs -> mobile/assets/wallpapers).
 */
export function wallpaperCss(scheme: Scheme, skin: Skin): string {
  const [a, b, c] = SKINS[skin][scheme].wallpaper
  return [
    `radial-gradient(70% 45% at 8% 6%, ${a} 0%, transparent 72%)`,
    `radial-gradient(60% 45% at 100% 38%, ${b} 0%, transparent 70%)`,
    `radial-gradient(80% 50% at 25% 100%, ${c} 0%, transparent 72%)`,
    BASE[scheme].bg,
  ].join(', ')
}
