import { isRtl, t } from '@shared/i18n'
import { Alert, DevSettings, I18nManager } from 'react-native'

/**
 * Right-to-left layout for Hebrew (and left-to-right for the others, even on
 * a phone set to an RTL language). React Native fixes the direction when the
 * app starts, so a change needs a reload: in development the JS reloads at
 * once; a release build asks the user to reopen the app.
 */
export function applyLayoutDirection(locale: string) {
  const rtl = isRtl(locale)
  if (I18nManager.isRTL === rtl) return
  I18nManager.allowRTL(rtl)
  I18nManager.forceRTL(rtl)
  if (__DEV__) {
    // Let the current render finish first.
    setTimeout(() => DevSettings.reload(), 0)
  } else {
    Alert.alert(t('settings.restartTitle'), t('settings.restartBody'))
  }
}
