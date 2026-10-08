import { setLocale, t } from '@shared/i18n'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { QuickRecordWidget } from './QuickRecordWidget'

/** Draws the home-screen widgets (they open the app themselves - nothing to do on a click). */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== 'QuickRecord') return
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    // Runs in the background, without the app: the label follows the phone's language.
    setLocale(Intl.DateTimeFormat().resolvedOptions().locale)
    renderWidget(<QuickRecordWidget label={t('widget.record')} />)
  }
}
