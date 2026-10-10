import { LANGUAGES, languageOf, t, type Language } from '@shared/i18n'
import type { NotificationSettings } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import * as Notifications from '@/lib/expoNotifications'
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { settingsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { DateTimeField } from '@/components/DateTimeField'
import { flatCard } from '@/components/panel'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import Ionicons from '@expo/vector-icons/Ionicons'
import { palette, SKIN_NAMES, skinLabel, THEMES, themeLabel, type AppearanceSettings } from '@shared/appearance'
import { Image } from 'expo-image'
import { applyAppearance, useAppearance } from '@/lib/appearance'
import { changeFirstDayOfWeek, useFirstDayOfWeek } from '@/lib/weekStart'
import { FIRST_DAYS, weekdayName } from '@shared/calendar'
import { wallpaperImage, wallpaperPhotoSource } from '@/components/Wallpaper'
import { pickPhotos } from '@/lib/media'
import { File } from 'expo-file-system'

/** Settings - Language, Notifications (same as web's Settings page). Changes save immediately. */
export default function SettingsScreen() {
  const c = useColors()
  // On the panel (with a wallpaper) the cards are flat: one layer only.
  const flat = c.panel && flatCard
  const { zone, changeLanguage } = useAuth()
  const [languageError, setLanguageError] = useState<string | null>(null)
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const recordings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings })
  const saveRecordings = useAction(settingsApi.updateRecordings)
  // Appearance: shown at once, saved to the account (every device follows).
  const look = useAppearance()
  const saveAppearance = useAction(settingsApi.updateAppearance)
  const firstDay = useFirstDayOfWeek()
  const saveCalendar = useAction(settingsApi.updateCalendar)
  const changeLook = (patch: Partial<AppearanceSettings>) => {
    const next = { ...look, ...patch }
    applyAppearance(next)
    saveAppearance.mutate(next)
  }
  // Your own wallpaper photo: from the gallery, shrunk here, then uploaded (the account keeps it).
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const changePhoto = async (run: () => Promise<AppearanceSettings | null>) => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const next = await run()
      if (next) applyAppearance(next)
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPhotoBusy(false)
    }
  }
  const choosePhoto = () =>
    changePhoto(async () => {
      const picked = await pickPhotos(false)
      const photo = picked?.added[0]
      if (!photo) {
        if (picked?.problems.length) throw new Error(picked.problems[0])
        return null
      }
      const form = new FormData()
      form.append('file', new File(photo.uri), photo.name)
      return settingsApi.setWallpaper(form)
    })
  const [osAllowed, setOsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setOsAllowed(p.granted))
  }, [])

  if (error) return <Screen panel><Text style={{ color: c.danger }}>{error.message}</Text></Screen>
  if (!settings) return <Screen panel><Text style={{ color: c.muted }}>{t('common.loading')}</Text></Screen>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <Screen panel>
      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.language').toUpperCase()}</Text>
      <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
        {LANGUAGES.map((l) => {
          const on = languageOf(zone.locale) === l.code
          return (
            <Pressable
              key={l.code}
              onPress={() => {
                setLanguageError(null)
                changeLanguage(l.code as Language).catch((e: Error) => setLanguageError(e.message))
              }}
              style={[styles.language, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontSize: 16 }}>{l.name}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.languageHint')}</Text>
      {languageError && <Text style={{ color: c.danger }}>{languageError}</Text>}

      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.appearance').toUpperCase()}</Text>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('settings.theme')}</Text>
      <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t('settings.theme')}>
        {THEMES.map((theme) => {
          const on = look.theme === theme
          return (
            <Pressable
              key={theme}
              onPress={() => changeLook({ theme })}
              style={[styles.language, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontSize: 16 }}>{themeLabel(theme)}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.themeHint')}</Text>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('settings.skin')}</Text>
      <View style={styles.skins} accessibilityRole="radiogroup" accessibilityLabel={t('settings.skin')}>
        {SKIN_NAMES.map((skin) => {
          const on = look.skin === skin
          const colors = palette(c.scheme, skin)
          return (
            <Pressable
              key={skin}
              onPress={() => changeLook({ skin })}
              style={[styles.skin, { borderColor: on ? c.accent : c.border, backgroundColor: colors.bg }]}
              accessibilityRole="radio"
              accessibilityLabel={skinLabel(skin)}
              accessibilityState={{ selected: on }}>
              <Image source={wallpaperImage(skin, c.scheme)} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[styles.skinDot, { backgroundColor: colors.accent }]}>
                {on && <Ionicons name="checkmark" size={18} color={colors.accentText} />}
              </View>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{skinLabel(skin)}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
        <Row label={t('settings.wallpaper')} hint={t('settings.wallpaperHint')} value={look.wallpaper} onChange={(wallpaper) => changeLook({ wallpaper })} />
        <View style={styles.photoRow}>
          {look.wallpaperPhoto && <Image source={wallpaperPhotoSource(look.wallpaperPhoto)} style={[styles.photoThumb, { borderColor: c.border }]} contentFit="cover" cachePolicy="disk" />}
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Button
                title={photoBusy ? t('settings.photoUploading') : look.wallpaperPhoto ? t('settings.changePhoto') : t('settings.myPhoto')}
                onPress={() => void choosePhoto()}
                disabled={photoBusy}
              />
              {look.wallpaperPhoto && (
                <Button title={t('settings.removePhoto')} variant="danger" onPress={() => void changePhoto(settingsApi.removeWallpaper)} disabled={photoBusy} />
              )}
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.photoHint')}</Text>
          </View>
        </View>
      </View>
      {photoError && <Text style={{ color: c.danger }}>{photoError}</Text>}
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.appearanceSync')}</Text>
      {saveAppearance.error && <Text style={{ color: c.danger }}>{saveAppearance.error.message}</Text>}

      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.calendar').toUpperCase()}</Text>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('settings.firstDay')}</Text>
      <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t('settings.firstDay')}>
        {FIRST_DAYS.map((day) => {
          const on = firstDay === day
          return (
            <Pressable
              key={day}
              onPress={() => {
                changeFirstDayOfWeek(day)
                saveCalendar.mutate({ firstDayOfWeek: day })
              }}
              style={[styles.language, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontSize: 16 }}>{weekdayName(day, zone.locale)}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.firstDayHint')}</Text>
      {saveCalendar.error && <Text style={{ color: c.danger }}>{saveCalendar.error.message}</Text>}

      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.notifications').toUpperCase()}</Text>
      {osAllowed === false && (
        <View style={[styles.warning, { borderColor: c.warn }]}>
          <Text style={{ color: c.text }}>{t('settings.phoneBlocked')}</Text>
          <Button title={t('settings.openPhoneSettings')} onPress={() => void Linking.openSettings()} />
        </View>
      )}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
        <Row label={t('settings.notifications')} hint={t('settings.notificationsHint')} value={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <Row label={t('settings.taskReminders')} value={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} disabled={!settings.enabled} />
        <Row
          label={t('settings.eventReminders')}
          value={settings.appointmentReminders}
          onChange={(appointmentReminders) => change({ appointmentReminders })}
          disabled={!settings.enabled}
        />
        <Row
          label={t('settings.dailySummary')}
          hint={t('settings.dailySummaryHint')}
          value={settings.dailySummary}
          onChange={(dailySummary) => change({ dailySummary })}
          disabled={!settings.enabled}
        />
        {settings.enabled && settings.dailySummary && (
          <View style={[styles.row, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t('settings.dailySummaryAt')}</Text>
            <DateTimeField mode="time" value={settings.dailySummaryTime} onChange={(time) => time && change({ dailySummaryTime: time })} placeholder={t('item.time')} />
          </View>
        )}
      </View>
      {save.error && <Text style={{ color: c.danger }}>{save.error.message}</Text>}

      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.recordings').toUpperCase()}</Text>
      {recordings.data && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
          <Row
            label={t('settings.keepRecordings')}
            hint={t('settings.keepRecordingsHint')}
            value={recordings.data.keepRecordings}
            onChange={(keepRecordings) => saveRecordings.mutate({ ...recordings.data!, keepRecordings })}
          />
          <Row
            label={t('settings.aiReadsMedia')}
            hint={t('settings.aiReadsMediaHint')}
            value={recordings.data.aiReadsMedia === true}
            onChange={(aiReadsMedia) => saveRecordings.mutate({ ...recordings.data!, aiReadsMedia })}
          />
        </View>
      )}
      {(recordings.error ?? saveRecordings.error) && <Text style={{ color: c.danger }}>{(recordings.error ?? saveRecordings.error)!.message}</Text>}
    </Screen>
  )
}

function Row({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <View style={[styles.row, { borderColor: c.border, opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
        {hint && <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.accent }} accessibilityLabel={label} />
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  warning: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  language: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  skins: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skin: { width: '31.5%', height: 84, borderWidth: 2, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  photoThumb: { width: 54, height: 96, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  skinDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 2 },
})
