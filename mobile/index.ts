// The app's entry: Expo Router, plus the Android home-screen widgets' handler
// (it runs in the background when a widget is added or redrawn). The widget
// library is Android-only, so iOS never loads it.
import 'expo-router/entry'
import { Platform } from 'react-native'
// The background reminder refresh must be defined before Android can run it, without the UI.
import './src/lib/backgroundReminders'

if (Platform.OS === 'android') {
  /* eslint-disable @typescript-eslint/no-require-imports -- loaded on Android only */
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget')
  const { widgetTaskHandler } = require('./src/widgets/taskHandler') as typeof import('./src/widgets/taskHandler')
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler)
}
