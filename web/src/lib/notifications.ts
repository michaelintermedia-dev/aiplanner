import type { UpcomingNotification } from '@shared/types'

/** Where a notification's item opens. */
export const itemPath = (n: Pick<UpcomingNotification, 'itemType' | 'itemId'>) =>
  n.itemType && n.itemId
    ? `/${n.itemType === 'Task' ? 'tasks' : n.itemType === 'Appointment' ? 'appointments' : 'notes'}/${n.itemId}`
    : '/today'

export const browserNotificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

const PERMISSION_EVENT = 'planner:notification-permission'

/** Must run from a click (browsers ignore permission prompts that aren't user-initiated). */
export async function requestBrowserPermission(): Promise<NotificationPermission> {
  const result = await Notification.requestPermission()
  window.dispatchEvent(new Event(PERMISSION_EVENT))
  return result
}

export function onPermissionChange(listener: () => void) {
  window.addEventListener(PERMISSION_EVENT, listener)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener(PERMISSION_EVENT, listener)
    window.removeEventListener('focus', listener)
  }
}
