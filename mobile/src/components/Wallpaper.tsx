import type { Skin } from '@shared/appearance'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { API_URL, getAccessToken } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { useAppearance } from '@/lib/appearance'
import { useColors } from '@/theme'

/** The skins' wallpapers, rendered from shared/appearance's wallpaperCss (tools/qa/wallpapers.cjs). */
const WALLPAPERS: Record<Skin, { light: number; dark: number }> = {
  Indigo: { light: require('../../assets/wallpapers/indigo-light.jpg'), dark: require('../../assets/wallpapers/indigo-dark.jpg') },
  Ocean: { light: require('../../assets/wallpapers/ocean-light.jpg'), dark: require('../../assets/wallpapers/ocean-dark.jpg') },
  Forest: { light: require('../../assets/wallpapers/forest-light.jpg'), dark: require('../../assets/wallpapers/forest-dark.jpg') },
  Sunset: { light: require('../../assets/wallpapers/sunset-light.jpg'), dark: require('../../assets/wallpapers/sunset-dark.jpg') },
  Rose: { light: require('../../assets/wallpapers/rose-light.jpg'), dark: require('../../assets/wallpapers/rose-dark.jpg') },
  Graphite: { light: require('../../assets/wallpapers/graphite-light.jpg'), dark: require('../../assets/wallpapers/graphite-dark.jpg') },
}

export const wallpaperImage = (skin: Skin, scheme: 'light' | 'dark') => WALLPAPERS[skin][scheme]

/** The user's own wallpaper photo (with the sign-in; cached on the device - a new photo gets a new id). */
export const wallpaperPhotoSource = (id: string) => ({
  uri: `${API_URL}/api/settings/wallpaper/${id}`,
  headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
  cacheKey: `wallpaper-${id}`,
})

/**
 * Behind every screen: the page colour, and when the wallpaper is on, the
 * user's photo (with a faint veil, so a busy photo doesn't drown the text) or
 * the skin's wallpaper. Screens paint `page` - transparent then.
 */
export function Wallpaper({ children }: { children: ReactNode }) {
  const c = useColors()
  const { skin, wallpaper, wallpaperPhoto } = useAppearance()
  // The photo needs the sign-in: until then (start-up) the skin's wallpaper shows.
  const { user } = useAuth()
  const photo = user ? wallpaperPhoto : null
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {wallpaper &&
        (photo ? (
          <>
            <Image source={wallpaperPhotoSource(photo)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: `${c.bg}40` }]} />
          </>
        ) : (
          <Image source={wallpaperImage(skin, c.scheme)} style={StyleSheet.absoluteFill} contentFit="cover" />
        ))}
      {children}
    </View>
  )
}
