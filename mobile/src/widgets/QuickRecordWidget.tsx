'use no memo'
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget'

/** Ionicons "mic" (512 x 512), white. */
const MIC =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#fff" d="M256 352a96 96 0 0 0 96-96V96a96 96 0 0 0-192 0v160a96 96 0 0 0 96 96z"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M400 192v64c0 79.4-64.6 144-144 144s-144-64.6-144-144v-64M256 400v80M192 480h128"/></svg>'

const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'aiplanner://record' } } as const

/**
 * The "Quick recording" home-screen widget: a round mic button with its name
 * under it, like the app icons around it (white, with a shadow for any
 * wallpaper). Tapping it opens the app recording (aiplanner://record).
 */
export function QuickRecordWidget({ label }: { label: string }) {
  return (
    <FlexWidget
      {...OPEN}
      style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'center', alignItems: 'center', flexGap: 4 }}>
      <FlexWidget
        {...OPEN}
        style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: '#4f5bd5', justifyContent: 'center', alignItems: 'center' }}>
        <SvgWidget svg={MIC} style={{ height: 26, width: 26 }} />
      </FlexWidget>
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
