import type { NotificationSettings } from '@shared/types'
import { LANGUAGES, languageOf, t, type Language } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { settingsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { applyAppearance, currentAppearance, photoUrl } from '../lib/appearance'
import { changeFirstDayOfWeek, useFirstDayOfWeek } from '../lib/weekStart'
import { FIRST_DAYS, weekdayName } from '@shared/calendar'
import { shrinkImage } from '../lib/media'
import { palette, SKIN_NAMES, skinLabel, THEMES, themeLabel, wallpaperCss, type AppearanceSettings } from '@shared/appearance'
import { IoCheckmark } from 'react-icons/io5'
import { browserNotificationsSupported, onPermissionChange, requestBrowserPermission } from '../lib/notifications'

/** Settings - Language, Notifications (spec "Settings"). Changes save immediately. */
export function SettingsPage() {
  const { zone, changeLanguage } = useAuth()
  const [languageError, setLanguageError] = useState<string | null>(null)
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const recordings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings })
  const saveRecordings = useAction(settingsApi.updateRecordings)
  const appearance = useQuery({ queryKey: ['settings', 'appearance'], queryFn: settingsApi.appearance })
  const saveAppearance = useAction(settingsApi.updateAppearance)
  const firstDay = useFirstDayOfWeek()
  const saveCalendar = useAction(settingsApi.updateCalendar)
  // Shown at once; saved to the account (every device follows).
  const [look, setLook] = useState<AppearanceSettings>(currentAppearance)
  useEffect(() => {
    if (appearance.data) queueMicrotask(() => setLook(appearance.data))
  }, [appearance.data])
  const changeLook = (patch: Partial<AppearanceSettings>) => {
    const next = { ...look, ...patch }
    setLook(next)
    applyAppearance(next)
    saveAppearance.mutate(next)
  }
  // Your own wallpaper photo: shrunk here, then uploaded (the account keeps it).
  const photoInput = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (look.wallpaperPhoto) void photoUrl(look.wallpaperPhoto).then((url) => live && setPhotoPreview(url))
    else queueMicrotask(() => live && setPhotoPreview(null))
    return () => {
      live = false
    }
  }, [look.wallpaperPhoto])
  const changePhoto = async (run: () => Promise<AppearanceSettings>) => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const next = await run()
      setLook(next)
      applyAppearance(next)
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPhotoBusy(false)
    }
  }
  const uploadPhoto = (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    void changePhoto(async () => {
      const file = await shrinkImage(new File([await picked.arrayBuffer()], picked.name, { type: picked.type }))
      const form = new FormData()
      form.append('file', file, file.name)
      return settingsApi.setWallpaper(form)
    })
  }
  const scheme = (document.documentElement.dataset.scheme as 'light' | 'dark' | undefined) ?? 'light'
  const supported = browserNotificationsSupported()
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'denied'))
  useEffect(() => onPermissionChange(() => setPermission(Notification.permission)), [])

  if (error) return <div className="page"><p className="error">{error.message}</p></div>
  if (!settings) return <div className="page"><p className="muted">{t('common.loading')}</p></div>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <div className="page settings">
      <section className="card form">
        <h3>{t('settings.language')}</h3>
        <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              lang={l.code}
              aria-checked={languageOf(zone.locale) === l.code}
              className={languageOf(zone.locale) === l.code ? 'active' : undefined}
              onClick={() => {
                setLanguageError(null)
                changeLanguage(l.code as Language).catch((e: Error) => setLanguageError(e.message))
              }}>
              {l.name}
            </button>
          ))}
        </div>
        <p className="muted small">{t('settings.languageHint')}</p>
        {languageError && <p className="error">{languageError}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.appearance')}</h3>
        <span className="field-label">{t('settings.theme')}</span>
        <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={look.theme === theme}
              className={look.theme === theme ? 'active' : undefined}
              onClick={() => changeLook({ theme })}>
              {themeLabel(theme)}
            </button>
          ))}
        </div>
        <p className="muted small">{t('settings.themeHint')}</p>
        <span className="field-label">{t('settings.skin')}</span>
        <div className="skins" role="radiogroup" aria-label={t('settings.skin')}>
          {SKIN_NAMES.map((skin) => (
            <button
              key={skin}
              type="button"
              role="radio"
              aria-checked={look.skin === skin}
              className={`skin${look.skin === skin ? ' active' : ''}`}
              style={{ background: wallpaperCss(scheme, skin) }}
              onClick={() => changeLook({ skin })}>
              <span className="skin-dot" style={{ background: palette(scheme, skin).accent }}>
                {look.skin === skin && <IoCheckmark aria-hidden style={{ color: palette(scheme, skin).accentText }} />}
              </span>
              <span className="skin-name">{skinLabel(skin)}</span>
            </button>
          ))}
        </div>
        <Toggle label={t('settings.wallpaper')} hint={t('settings.wallpaperHint')} checked={look.wallpaper} onChange={(wallpaper) => changeLook({ wallpaper })} />
        <div className="wallpaper-photo">
          {photoPreview && <img src={photoPreview} alt="" className="wallpaper-photo-thumb" />}
          <div className="wallpaper-photo-actions">
            <button type="button" className="chip-button" disabled={photoBusy} onClick={() => photoInput.current?.click()}>
              {photoBusy ? t('settings.photoUploading') : look.wallpaperPhoto ? t('settings.changePhoto') : t('settings.myPhoto')}
            </button>
            {look.wallpaperPhoto && (
              <button type="button" className="link danger" disabled={photoBusy} onClick={() => void changePhoto(settingsApi.removeWallpaper)}>
                {t('settings.removePhoto')}
              </button>
            )}
          </div>
          <p className="muted small">{t('settings.photoHint')}</p>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              uploadPhoto(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        {photoError && <p className="error">{photoError}</p>}
        <p className="muted small">{t('settings.appearanceSync')}</p>
        {saveAppearance.error && <p className="error">{saveAppearance.error.message}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.calendar')}</h3>
        <span className="field-label">{t('settings.firstDay')}</span>
        <div className="segmented" role="radiogroup" aria-label={t('settings.firstDay')}>
          {FIRST_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={firstDay === day}
              className={firstDay === day ? 'active' : undefined}
              onClick={() => {
                changeFirstDayOfWeek(day)
                saveCalendar.mutate({ firstDayOfWeek: day })
              }}>
              {weekdayName(day, zone.locale)}
            </button>
          ))}
        </div>
        <p className="muted small">{t('settings.firstDayHint')}</p>
        {saveCalendar.error && <p className="error">{saveCalendar.error.message}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.notifications')}</h3>

        <div className="settings-row">
          <div>
            <strong>{t('settings.thisBrowser')}</strong>
            <p className="muted small">
              {!supported
                ? t('settings.browser.unsupported')
                : permission === 'granted'
                  ? t('settings.browser.on')
                  : permission === 'denied'
                    ? t('settings.browser.blocked')
                    : t('settings.off')}
            </p>
          </div>
          {supported && permission === 'default' && (
            <button type="button" className="primary" onClick={() => void requestBrowserPermission().then(setPermission)}>
              {t('settings.turnOn')}
            </button>
          )}
        </div>

        <Toggle label={t('settings.notifications')} hint={t('settings.notificationsHint')} checked={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <fieldset className="settings-group" disabled={!settings.enabled}>
          <Toggle label={t('settings.taskReminders')} checked={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} />
          <Toggle label={t('settings.eventReminders')} checked={settings.appointmentReminders} onChange={(appointmentReminders) => change({ appointmentReminders })} />
          <Toggle
            label={t('settings.dailySummary')}
            hint={t('settings.dailySummaryHint')}
            checked={settings.dailySummary}
            onChange={(dailySummary) => change({ dailySummary })}
          />
          {settings.dailySummary && (
            <label className="settings-row">
              <span>{t('settings.dailySummaryAt')}</span>
              <input
                type="time"
                value={settings.dailySummaryTime}
                onChange={(e) => e.target.value && change({ dailySummaryTime: e.target.value })}
              />
            </label>
          )}
        </fieldset>
        {save.error && <p className="error">{save.error.message}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.recordings')}</h3>
        {recordings.data && (
          <>
            <Toggle
              label={t('settings.oneEntry')}
              hint={t('settings.oneEntryHint')}
              checked={recordings.data.oneEntryPerMessage}
              onChange={(oneEntryPerMessage) => saveRecordings.mutate({ ...recordings.data!, oneEntryPerMessage })}
            />
            <Toggle
              label={t('settings.keepRecordings')}
              hint={t('settings.keepRecordingsHint')}
              checked={recordings.data.keepRecordings}
              onChange={(keepRecordings) => saveRecordings.mutate({ ...recordings.data!, keepRecordings })}
            />
          </>
        )}
        {(recordings.error ?? saveRecordings.error) && <p className="error">{(recordings.error ?? saveRecordings.error)!.message}</p>}
      </section>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-row">
      <div>
        <strong>{label}</strong>
        {hint && <p className="muted small">{hint}</p>}
      </div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
