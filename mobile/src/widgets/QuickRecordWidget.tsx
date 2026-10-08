'use no memo'
import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget'

/** Ionicons "mic" (512 x 512) in the given colour. */
const mic = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${color}" d="M256 352a96 96 0 0 0 96-96V96a96 96 0 0 0-192 0v160a96 96 0 0 0 96 96z"/><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M400 192v64c0 79.4-64.6 144-144 144s-144-64.6-144-144v-64M256 400v80M192 480h128"/></svg>`

const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'aiplanner://record' } } as const
const SIZE = 64

/** How the widget looks: the skin's accent (light or dark) and, when the wallpaper is on, the wallpaper inside the circle. */
export interface WidgetLook {
  accent: `#${string}`
  accentText: `#${string}`
  /** The wallpaper (a bundled skin wallpaper, or a data: URI of the user's photo); null = a plain accent circle. */
  image: number | `data:image${string}` | null
}

/**
 * The "Quick recording" home-screen widget: a round mic button with its name
 * under it, like the app icons around it. It follows Settings - Appearance:
 * the skin's accent, light or dark, and the wallpaper inside the circle (with
 * a smaller accent disc carrying the mic, so it reads on any picture).
 * Tapping it opens the app recording (aiplanner://record).
 */
export function QuickRecordWidget({ label, look }: { label: string; look: WidgetLook }) {
  return (
    <FlexWidget
      {...OPEN}
      style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'center', alignItems: 'center', flexGap: 4 }}>
      {look.image ? (
        <OverlapWidget {...OPEN} style={{ height: SIZE, width: SIZE }}>
          <FlexWidget style={{ height: SIZE, width: SIZE, borderRadius: SIZE / 2, backgroundColor: look.accent }} />
          <FlexWidget style={{ height: SIZE, width: SIZE, justifyContent: 'center', alignItems: 'center' }}>
            <ImageWidget image={look.image} imageWidth={SIZE - 6} imageHeight={SIZE - 6} radius={(SIZE - 6) / 2} resizeMode="cover" />
          </FlexWidget>
          <FlexWidget style={{ height: SIZE, width: SIZE, justifyContent: 'center', alignItems: 'center' }}>
            <FlexWidget
              style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: look.accent, justifyContent: 'center', alignItems: 'center' }}>
              <SvgWidget svg={mic(look.accentText)} style={{ height: 22, width: 22 }} />
            </FlexWidget>
          </FlexWidget>
        </OverlapWidget>
      ) : (
        <FlexWidget
          {...OPEN}
          style={{ height: SIZE, width: SIZE, borderRadius: SIZE / 2, backgroundColor: look.accent, justifyContent: 'center', alignItems: 'center' }}>
          <SvgWidget svg={mic(look.accentText)} style={{ height: 32, width: 32 }} />
        </FlexWidget>
      )}
      <TextWidget
        {...OPEN}
        text={label}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: 14,
          color: '#ffffff',
          textAlign: 'center',
          textShadowColor: '#99000000',
          textShadowRadius: 3,
          textShadowOffset: { width: 0, height: 1 },
        }}
      />
    </FlexWidget>
  )
}
