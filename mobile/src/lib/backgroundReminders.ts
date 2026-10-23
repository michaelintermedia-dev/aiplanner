import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { refreshSession } from '@/api/client'
import { notificationsApi } from '@/api/endpoints'
import { schedule } from '@/lib/useNotifications'
import { syncPhoneCalendar } from '@/lib/phoneCalendar'

/**
 * Reminders without opening the app (2026-10-18). The phone only knows the
 * reminders the app scheduled last time (the next 7 days, at most 60); opened
 * rarely, later ones were never scheduled. Android now runs this every few
 * hours in the background - signed in from the stored session, it asks the
 * server what's coming and schedules it, like the app does when it's open.
 * No push service needed. Defined at startup (index.ts), registered once the
 * notifications are allowed (useNotifications).
 */
const TASK = 'gatazee-reminders'

TaskManager.defineTask(TASK, async () => {
  try {
    if (!(await refreshSession())) return BackgroundTask.BackgroundTaskResult.Success // signed out: nothing to do
    await schedule(await notificationsApi.upcoming(168))
    await syncPhoneCalendar()
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export async function registerBackgroundReminders() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return
    // Minutes; Android decides the exact moment (battery, network) - a few hours is plenty.
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 180 })
  } catch {
    // not available (e.g. Expo Go): the app still schedules whenever it's opened
  }
}
