import { palette, type Scheme } from '@shared/appearance'
import { useColorScheme } from 'react-native'
import { useAppearance } from '@/lib/appearance'

/**
 * The app's colours: light or dark (Settings - Theme; "System" follows the
 * phone) in the chosen skin - the same palette as the web (shared/appearance).
 * `page` is what screens paint behind their content: transparent while the
 * skin's wallpaper shows (<Wallpaper> is behind every screen).
 */
export function useColors() {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const { skin, wallpaper } = useAppearance()
  const colors = palette(scheme, skin)
  // Text that sits right on the wallpaper (not on a card) gets a pill behind
  // it - like WhatsApp's date chips - so it reads on any wallpaper.
  const pill = wallpaper ? { backgroundColor: `${colors.surface}D9`, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' as const } : null
  // Several lines (Today's greeting and date): one block.
  const block = wallpaper ? { backgroundColor: `${colors.surface}D9`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 } : null
  // A loose line of text (loading, errors, "nothing planned"): a pill at its start.
  const pillStart = pill && { ...pill, alignSelf: 'flex-start' as const }
  // A whole screen of text and controls (an item, Settings, sign-in): one frosted panel.
  const panel = wallpaper ? { backgroundColor: `${colors.surface}E6`, padding: 14, borderRadius: 18 } : null
  return { ...colors, page: wallpaper ? 'transparent' : colors.bg, scheme, pill, pillStart, block, panel }
}

export type Colors = ReturnType<typeof useColors>
