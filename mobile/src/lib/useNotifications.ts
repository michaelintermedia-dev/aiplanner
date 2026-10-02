import type { ItemType, UpcomingNotification } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Notifications from '@/lib/expoNotifications'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, AppState, Platform } from 'react-native'
import { notificationsApi, tasksApi } from '@/api/endpoints'
import { currentLanguage, t } from '@shared/i18n'

/**
 * Phase 4 delivery on the phone. The backend decides what goes off when
 * (GET /notifications/upcoming); this schedules those as *local*
 * notifications - which work in Expo Go, unlike remote push - and keeps them
 * in sync: on launch, when the app comes back to the foreground, every 15
 * minutes, and after every change (all mutations invalidate all queries,
 * which refetches the schedule).
 *
 * Actions (spec section 23): Done (tasks), Snooze 15 min / 1 hour, and
 * tapping opens the item.
 */

const CHANNEL = 'reminders'
/** iOS keeps at most 64 pending local notifications; stay under it. */
const MAX_SCHEDULED = 60

interface NotificationData {
  key: string
  itemType: ItemType | null
  itemId: string | null
  title: string
  body: string | null
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

/** Our Android channel, once created. Expo Go can't create channels (its channel
 *  provider is missing), so there notifications use Expo's default channel. */
let channelId: string | undefined
let setupDone: Promise<void> | null = null
let setupLanguage = ''
const setup = () => {
  // The action buttons carry text: set them up again after a language change.
  if (setupLanguage !== currentLanguage()) {
    setupLanguage = currentLanguage()
    setupDone = null
  }
  return (setupDone ??= (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync(CHANNEL, {
            name: t('notifications.channel'),
            importance: Notifications.AndroidImportance.HIGH,
          })
          channelId = CHANNEL
        } catch (e) {
          console.log('[notif] using the default channel:', String(e).split('\n')[0])
        }
      }
      const snooze = [
        { identifier: 'snooze15', buttonTitle: t('notifications.snooze15'), options: { opensAppToForeground: true } },
        { identifier: 'snooze60', buttonTitle: t('notifications.snooze60'), options: { opensAppToForeground: true } },
      ]
      try {
        await Notifications.setNotificationCategoryAsync('task', [
          { identifier: 'done', buttonTitle: t('common.done'), options: { opensAppToForeground: true } },
          ...snooze,
        ])
        await Notifications.setNotificationCategoryAsync('item', snooze)
      } catch (e) {
        console.log('[notif] no action buttons:', String(e).split('\n')[0])
      }
  })())
}

async function ensurePermission(): Promise<boolean> {
  await setup() // Android 13+ only asks once a channel exists
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false
  return (await Notifications.requestPermissionsAsync()).granted
}

/** Makes the phone's scheduled notifications match the backend's list. */
async function schedule(list: UpcomingNotification[]) {
  const now = Date.now()
  const wanted = list.filter((n) => new Date(n.atUtc).getTime() > now + 1000).slice(0, MAX_SCHEDULED)
  const byKey = new Map(wanted.map((n) => [n.key, n]))
  const existing = await Notifications.getAllScheduledNotificationsAsync()
  const kept = new Set<string>()

  for (const e of existing) {
    const n = byKey.get(e.identifier)
    // Same occurrence with the same text: leave it. Anything else: cancel.
    if (n && e.content.title === n.title && (e.content.body ?? null) === n.body) kept.add(e.identifier)
    else await Notifications.cancelScheduledNotificationAsync(e.identifier)
  }

  for (const n of wanted) {
    if (kept.has(n.key)) continue
    const data: NotificationData = { key: n.key, itemType: n.itemType, itemId: n.itemId, title: n.title, body: n.body }
    await Notifications.scheduleNotificationAsync({
      identifier: n.key,
      content: {
        title: n.title,
        body: n.body ?? undefined,
        data: data as unknown as Record<string, unknown>,
        categoryIdentifier: n.canComplete ? 'task' : n.itemType ? 'item' : undefined,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.atUtc), channelId },
    })
  }
}

const openItem = (d: NotificationData) => {
  if (d.itemType === 'Task' && d.itemId) router.push({ pathname: '/task/[id]', params: { id: d.itemId } })
  else if (d.itemType === 'Appointment' && d.itemId) router.push({ pathname: '/appointment/[id]', params: { id: d.itemId } })
  else if (d.itemType === 'Note' && d.itemId) router.push({ pathname: '/note/[id]', params: { id: d.itemId } })
  else router.push('/today')
}

/** Responses already acted on (useLastNotificationResponse repeats the last one on remount). */
const handled = new Set<string>()

async function handleResponse(response: Notifications.NotificationResponse) {
  const d = response.notification.request.content.data as unknown as NotificationData
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {})
  switch (response.actionIdentifier) {
    case 'done':
      if (d.itemId) await tasksApi.complete(d.itemId)
      return
    case 'snooze15':
    case 'snooze60':
      if (d.itemType && d.itemId) {
        await notificationsApi.snooze({
          itemType: d.itemType,
          itemId: d.itemId,
          title: d.title,
          body: d.body,
          minutes: response.actionIdentifier === 'snooze15' ? 15 : 60,
        })
      }
      return
    default:
      openItem(d)
  }
}

/** Mount once, inside the signed-in part of the app. */
export function useNotifications() {
  const queryClient = useQueryClient()
  const [permitted, setPermitted] = useState<boolean | null>(null)

  useEffect(() => {
    ensurePermission().then(setPermitted, () => setPermitted(false))
  }, [])

  const { data } = useQuery({
    queryKey: ['notifications', 'upcoming'],
    queryFn: () => notificationsApi.upcoming(168),
    enabled: permitted === true,
    refetchInterval: 15 * 60 * 1000,
  })

  useEffect(() => {
    if (data) schedule(data).catch((e) => console.warn('Scheduling notifications failed', e))
  }, [data])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    return () => sub.remove()
  }, [queryClient])

  const response = Notifications.useLastNotificationResponse()
  useEffect(() => {
    if (!response) return
    const id = `${response.notification.request.identifier}|${response.actionIdentifier}`
    if (handled.has(id)) return
    handled.add(id)
    // Otherwise the OS hands the same response back on the next app load and
    // the item would open (or the action run) again.
    Notifications.clearLastNotificationResponse()
    handleResponse(response)
      .then(() => queryClient.invalidateQueries())
      .catch((e: Error) => Alert.alert(t('notifications.actionFailed'), e.message))
  }, [response, queryClient])

  return { permitted }
}
