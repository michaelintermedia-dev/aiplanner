/**
 * The parts of expo-notifications this app uses: *local* notifications only.
 *
 * Imported file by file on purpose. The package's main entry runs a push-token
 * auto-registration side effect that throws in Expo Go on Android since SDK 53
 * ("remote notifications ... removed from Expo Go"), which takes the whole app
 * down. Local notifications don't need any of that and work in Expo Go.
 * When the app moves to a development build (for remote push), this can go
 * back to `import * as Notifications from 'expo-notifications'`.
 */
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types'
export { SchedulableTriggerInputTypes, type NotificationResponse } from 'expo-notifications/build/Notifications.types'
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler'
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync'
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync'
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions'
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync'
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync'
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync'
export { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync'
export { useLastNotificationResponse } from 'expo-notifications/build/useLastNotificationResponse'
export { clearLastNotificationResponse } from 'expo-notifications/build/NotificationsEmitter'
