import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { QuickRecordWidget } from './QuickRecordWidget'

/** Draws the home-screen widgets (they open the app themselves - nothing to do on a click). */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== 'QuickRecord') return
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(<QuickRecordWidget />)
  }
}
