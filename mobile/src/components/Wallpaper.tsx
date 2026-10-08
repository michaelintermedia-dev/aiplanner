import type { Skin } from '@shared/appearance'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
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

/** Behind every screen: the page colour, and the skin's wallpaper when it's on (screens paint `page`, transparent then). */
export function Wallpaper({ children }: { children: ReactNode }) {
  const c = useColors()
  const { skin, wallpaper } = useAppearance()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {wallpaper && <Image source={wallpaperImage(skin, c.scheme)} style={StyleSheet.absoluteFill} contentFit="cover" />}
      {children}
    </View>
  )
}
