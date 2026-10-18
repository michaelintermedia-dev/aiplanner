import { pushApi } from '../api/endpoints'

/**
 * Web push (2026-10-18): reminders in this browser even with every Gatazee tab
 * closed. The service worker (public/sw.js) shows them; the server sends them
 * at their time (PushDispatchWorker). Remembered per browser, so an open tab
 * doesn't show the same reminders itself (useNotificationDelivery).
 */
const KEY = 'web-push-on'

export const webPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function webPushOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // not kept: the open tab may show a reminder the push also shows (same tag - replaced, not doubled)
  }
}

const base64ToBytes = (b64url: string) => {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
const bytesToBase64Url = (buffer: ArrayBuffer | null) =>
  buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : ''

/** Null when the server has no push keys (the switch is hidden then). */
export async function webPushKey(): Promise<string | null> {
  return (await pushApi.key()).publicKey
}

/** Asks for permission if needed, subscribes this browser and tells the server. */
export async function enableWebPush(publicKey: string): Promise<boolean> {
  if ((await Notification.requestPermission()) !== 'granted') return false
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) }))
  await pushApi.subscribe({
    endpoint: subscription.endpoint,
    p256dh: bytesToBase64Url(subscription.getKey('p256dh')),
    auth: bytesToBase64Url(subscription.getKey('auth')),
  })
  remember(true)
  return true
}

export async function disableWebPush(): Promise<void> {
  remember(false)
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await pushApi.unsubscribe(subscription.endpoint).catch(() => {})
  await subscription.unsubscribe()
}
