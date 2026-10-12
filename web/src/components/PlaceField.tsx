import { t } from '@shared/i18n'
import { placeFromPosition } from '@shared/links'
import { useState } from 'react'
import { IoLocateOutline } from 'react-icons/io5'

/**
 * The place of an item, typed or "Use my location" (user's request,
 * 2026-10-12). A browser gives only the position, so it's saved as
 * coordinates - Google Maps and Waze open those exactly. Same as the app's
 * PlaceField (which also looks up the street address).
 */
export function PlaceField({ value, onChange, changed }: { value: string; onChange: (place: string) => void; changed: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = () => {
    if (!navigator.geolocation) return setError(t('place.unavailable'))
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        onChange(placeFromPosition(pos.coords.latitude, pos.coords.longitude))
      },
      (err) => {
        setBusy(false)
        setError(err.code === err.PERMISSION_DENIED ? t('place.noPermission') : t('place.unavailable'))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className={`place-field${changed}`} title={changed ? t('form.changedByAi') : undefined}>
      <label htmlFor="place-input">{t('event.location')}</label>
      <div className="place-field-row">
        <input id="place-input" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="icon-button" onClick={locate} disabled={busy} title={t('place.useMyLocation')} aria-label={t('place.useMyLocation')}>
          <IoLocateOutline />
        </button>
      </div>
      {busy && <p className="muted small">{t('place.locating')}</p>}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
