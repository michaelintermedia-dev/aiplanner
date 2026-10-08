import { palette, type AppearanceSettings, type Scheme } from '@shared/appearance'
import { File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { API_URL, getAccessToken } from '@/api/client'
import { wallpaperImage } from '@/components/Wallpaper'
import type { WidgetLook } from './QuickRecordWidget'

/**
 * The widget's look from Settings - Appearance. The widget runs without the
 * app (and without the sign-in), so the user's photo is kept as a small round
 * thumbnail on the device (widget-photo.json) - made when the photo is set.
 */
const thumbFile = () => new File(Paths.document, 'widget-photo.json')

function storedThumb(photoId: string): `data:image${string}` | null {
  try {
    const f = thumbFile()
    if (!f.exists) return null
    const stored = JSON.parse(f.textSync()) as { id: string; uri: `data:image${string}` }
    return stored.id === photoId ? stored.uri : null
  } catch {
    return null
  }
}

export function widgetLook(settings: AppearanceSettings, scheme: Scheme): WidgetLook {
  const colors = palette(scheme, settings.skin)
  const photo = settings.wallpaper && settings.wallpaperPhoto ? storedThumb(settings.wallpaperPhoto) : null
  return {
    accent: colors.accent as `#${string}`,
    accentText: colors.accentText as `#${string}`,
    image: !settings.wallpaper ? null : (photo ?? wallpaperImage(settings.skin, scheme)),
  }
}

/** Makes the photo's widget thumbnail (signed in, in the app). Best effort: without it the skin's wallpaper shows. */
export async function makeWidgetThumb(photoId: string): Promise<void> {
  if (storedThumb(photoId)) return
  try {
    const download = new File(Paths.cache, `wallpaper-${photoId}.jpg`)
    if (!download.exists) {
      await File.downloadFileAsync(`${API_URL}/api/settings/wallpaper/${photoId}`, download, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
    }
    const image = await ImageManipulator.manipulate(download.uri).resize({ width: 160 }).renderAsync()
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true })
    if (!saved.base64) return
    const f = thumbFile()
    if (!f.exists) f.create()
    f.write(JSON.stringify({ id: photoId, uri: `data:image/jpeg;base64,${saved.base64}` }))
  } catch {
    // not made - the widget shows the skin's wallpaper
  }
}
