import { setLocale, t } from '@shared/i18n'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { currentAppearance } from '@/lib/appearance'
import { QuickRecordWidget } from './QuickRecordWidget'
import { widgetLook } from './widgetLook'

/**
 * The widget as it looks now (Settings - Appearance). "System" gives Android a
 * light and a dark version - it shows the one for the phone's mode by itself.
 */
export function renderQuickRecord() {
  // Runs in the background, without the app: the label follows the phone's language.
  setLocale(Intl.DateTimeFormat().resolvedOptions().locale)
  const label = t('widget.record')
  const settings = currentAppearance()
  const light = <QuickRecordWidget label={label} look={widgetLook(settings, 'light')} />
  const dark = <QuickRecordWidget label={label} look={widgetLook(settings, 'dark')} />
  return settings.theme === 'Light' ? light : settings.theme === 'Dark' ? dark : { light, dark }
}

/** Draws the home-screen widgets (they open the app themselves - nothing to do on a click). */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== 'QuickRecord') return
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(renderQuickRecord())
  }
}
