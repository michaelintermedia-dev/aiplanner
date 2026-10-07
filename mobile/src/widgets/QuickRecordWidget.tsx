'use no memo'
import { FlexWidget, SvgWidget } from 'react-native-android-widget'

/** Ionicons "mic" (512 x 512), white. */
const MIC =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#fff" d="M256 352a96 96 0 0 0 96-96V96a96 96 0 0 0-192 0v160a96 96 0 0 0 96 96z"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M400 192v64c0 79.4-64.6 144-144 144s-144-64.6-144-144v-64M256 400v80M192 480h128"/></svg>'

/**
 * The "Quick recording" home-screen widget: one round mic button that opens
 * the app recording (aiplanner://record). No text, so no language to follow.
 */
export function QuickRecordWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'aiplanner://record' }}
      style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'aiplanner://record' }}
        style={{ height: 64, width: 64, borderRadius: 32, backgroundColor: '#4f5bd5', justifyContent: 'center', alignItems: 'center' }}>
        <SvgWidget svg={MIC} style={{ height: 32, width: 32 }} />
      </FlexWidget>
    </FlexWidget>
  )
}
