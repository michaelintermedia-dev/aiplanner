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
  /**
   * The wallpaper (WhatsApp-like: big organic shapes in muted tones that
   * overlap, on a paper texture): the background and four shape colours -
   * top-left lobe, the tall middle shape, the bottom shape, a corner sliver.
   */
  wallpaper: { bg: string; shapes: [string, string, string, string] }
}

/** Each skin in light and dark. */
export const SKINS: Record<Skin, Record<Scheme, SkinColors>> = {
  Indigo: {
    light: { accent: '#4f5bd5', accentSoft: '#e8eafb', accentText: '#ffffff', wallpaper: { bg: '#e6e2ec', shapes: ['#5d5f86', '#9da4d4', '#d9b4a6', '#2f3463'] } },
    dark: { accent: '#8b94f5', accentSoft: '#262a4d', accentText: '#121212', wallpaper: { bg: '#17171f', shapes: ['#2b2d4a', '#3c4277', '#4d3a40', '#1e2140'] } },
  },
  Ocean: {
    light: { accent: '#0e7490', accentSoft: '#dff3f8', accentText: '#ffffff', wallpaper: { bg: '#e3e6e2', shapes: ['#4f6672', '#86b5bd', '#d8c3a5', '#25485a'] } },
    dark: { accent: '#4fc3dc', accentSoft: '#12343d', accentText: '#0b1d22', wallpaper: { bg: '#121819', shapes: ['#21323a', '#25525a', '#4a4232', '#152a35'] } },
  },
  Forest: {
    light: { accent: '#2f7d4f', accentSoft: '#e3f2e8', accentText: '#ffffff', wallpaper: { bg: '#d6cfc6', shapes: ['#55524c', '#7f8f66', '#b8957c', '#2f3a2a'] } },
    dark: { accent: '#6fcf97', accentSoft: '#173726', accentText: '#0d1f15', wallpaper: { bg: '#161715', shapes: ['#2a2a27', '#36452f', '#4a382d', '#1c241b'] } },
  },
  Sunset: {
    light: { accent: '#c2410c', accentSoft: '#fdeadf', accentText: '#ffffff', wallpaper: { bg: '#efe2d3', shapes: ['#8a4b3c', '#e0a35c', '#c97b5f', '#5b2f3a'] } },
    dark: { accent: '#fb923c', accentSoft: '#3e2414', accentText: '#1f1309', wallpaper: { bg: '#1a1513', shapes: ['#3d2420', '#5a4022', '#4f2e24', '#2e1a20'] } },
  },
  Rose: {
    light: { accent: '#be185d', accentSoft: '#fbe4ef', accentText: '#ffffff', wallpaper: { bg: '#efe1e1', shapes: ['#7d4a5c', '#d9a2b4', '#c9a99a', '#4e2a3c'] } },
    dark: { accent: '#f472b6', accentSoft: '#3d1a2c', accentText: '#1f0d17', wallpaper: { bg: '#1a1416', shapes: ['#3a2430', '#5a2f45', '#46352f', '#2a1823'] } },
  },
  Graphite: {
    light: { accent: '#374151', accentSoft: '#e8e9ec', accentText: '#ffffff', wallpaper: { bg: '#dedcd8', shapes: ['#5a5c60', '#a3a7ad', '#bfb5a8', '#33363b'] } },
    dark: { accent: '#cbd5e1', accentSoft: '#2a2f38', accentText: '#121212', wallpaper: { bg: '#151617', shapes: ['#2a2c2f', '#3a3e44', '#3d3934', '#1f2124'] } },
  },
}

/** All colour tokens for a scheme and skin (the apps' `Colors`). */
export function palette(scheme: Scheme, skin: Skin) {
  const s = SKINS[skin][scheme]
  return { ...BASE[scheme], accent: s.accent, accentSoft: s.accentSoft, accentText: s.accentText, appointment: s.accent }
}

/** Wallpaper image name (rendered by tools/qa/wallpapers.cjs; web: /wallpapers/, mobile: assets/wallpapers/). */
export const wallpaperFile = (skin: Skin, scheme: Scheme, wide = false) => `${skin.toLowerCase()}-${scheme}${wide ? '-wide' : ''}.jpg`

/** The web's page background: the wallpaper image (landscape on wide screens). */
export function wallpaperCss(scheme: Scheme, skin: Skin, wide = false): string {
  return `${SKINS[skin][scheme].wallpaper.bg} url("/wallpapers/${wallpaperFile(skin, scheme, wide)}") center / cover no-repeat`
}
