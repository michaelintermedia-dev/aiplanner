import { googleCalendarAddUrl, webcalUrl } from '@shared/calendarFeed'
import { t } from '@shared/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Linking, Share, Text, View } from 'react-native'
import { settingsApi } from '@/api/endpoints'
import { useColors } from '@/theme'
import { Button } from './ui'

/**
 * Settings - Calendar - "Show in your phone's calendar" (same as the web): a
 * private link Google / Apple / Outlook calendars subscribe to, read-only.
 */
export function CalendarFeedSetting() {
  const c = useColors()
  const queryClient = useQueryClient()
  const feed = useQuery({ queryKey: ['settings', 'calendar-feed'], queryFn: settingsApi.calendarFeed })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = feed.data?.url ?? null

  const run = async (action: () => Promise<{ url: string | null } | void>) => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      queryClient.setQueryData(['settings', 'calendar-feed'], result ?? { url: null })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }
  const open = (link: string) => Linking.openURL(link).catch((e: Error) => setError(e.message))

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('settings.feed.title')}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.feed.hint')}</Text>
      {!url ? (
        <Button title={t('settings.feed.create')} variant="primary" busy={busy || feed.isPending} onPress={() => void run(settingsApi.newCalendarFeed)} />
      ) : (
        <>
          <Button title={t('settings.feed.google')} variant="primary" onPress={() => void open(googleCalendarAddUrl(url))} />
          <Button title={t('settings.feed.apple')} onPress={() => void open(webcalUrl(url))} />
          {/* The share sheet: copy it, or send it to another device. */}
          <Button title={t('settings.feed.copy')} onPress={() => void Share.share({ message: url })} />
          <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.feed.private')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button title={t('settings.feed.new')} variant="link" disabled={busy} onPress={() => void run(settingsApi.newCalendarFeed)} />
            <Button title={t('settings.feed.off')} variant="link" disabled={busy} onPress={() => void run(settingsApi.turnOffCalendarFeed)} />
          </View>
        </>
      )}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
    </View>
  )
}
