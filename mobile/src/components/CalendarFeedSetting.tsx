import { googleCalendarAddUrl, webcalUrl } from '@shared/calendarFeed'
import { t } from '@shared/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Linking, Share, Switch, Text, View } from 'react-native'
import { settingsApi } from '@/api/endpoints'
import { useColors } from '@/theme'
import { phoneCalendarOn, phoneCalendarStatus, turnOffPhoneCalendar, turnOnPhoneCalendar } from '@/lib/phoneCalendar'
import { useAuth } from '@/auth/useAuth'
import { formatTime } from '@shared/dates'
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
  const [phoneOn, setPhoneOn] = useState(phoneCalendarOn)
  const [status, setStatus] = useState(phoneCalendarStatus)
  const { zone } = useAuth()
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

  const togglePhone = async (next: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (next) {
        if (await turnOnPhoneCalendar()) setPhoneOn(true)
        else setError(t('settings.phoneCal.denied'))
        setStatus(phoneCalendarStatus())
      } else {
        await turnOffPhoneCalendar()
        setPhoneOn(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setPhoneOn(phoneCalendarOn())
      setStatus(phoneCalendarStatus())
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {/* On the phone: written straight into a "Gatazee" calendar (Samsung / Google Calendar can't take a link). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontWeight: '600' }}>{t('settings.phoneCal.title')}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.phoneCal.hint')}</Text>
          {phoneOn && status && (
            <Text style={{ color: status.error ? c.danger : c.muted, fontSize: 13 }}>
              {status.error
                ? t('settings.phoneCal.failed', { error: status.error })
                : t('settings.phoneCal.status', { count: status.count, time: formatTime(new Date(status.at).toISOString(), zone) })}
            </Text>
          )}
        </View>
        <Switch value={phoneOn} disabled={busy} onValueChange={(v) => void togglePhone(v)} />
      </View>
      <Text style={{ color: c.text, fontWeight: '600', marginTop: 8 }}>{t('settings.feed.title')}</Text>
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
