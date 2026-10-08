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
  return { ...colors, page: wallpaper ? 'transparent' : colors.bg, scheme }
}

export type Colors = ReturnType<typeof useColors>
