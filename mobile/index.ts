// The app's entry: Expo Router, plus the Android home-screen widgets' handler
// (it runs in the background when a widget is added or redrawn).
import 'expo-router/entry'
import { registerWidgetTaskHandler } from 'react-native-android-widget'
import { widgetTaskHandler } from './src/widgets/taskHandler'

registerWidgetTaskHandler(widgetTaskHandler)
