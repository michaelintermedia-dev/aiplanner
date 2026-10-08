import { formatDateKey, formatTime, dateKey } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { IoKeypadOutline, IoMicOutline } from 'react-icons/io5'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { toWav } from '../lib/toWav'
import { speedRef, usePlaybackSpeed } from '../lib/playbackSpeed'
import { SpeedChips } from './SpeedChips'
import { t } from '@shared/i18n'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21 - voice capture history).
 * Read and listen only - adding to the item and deleting the recording are in
 * its Edit page.
 */
export function SourceCapture({ captureId }: { captureId: string }) {
  const { zone } = useAuth()
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })

  if (error) return null // The capture may have been removed; the item still stands on its own.
  if (!capture) return <p className="muted">{t('source.loading')}</p>
  // Made for an item created by hand, and nothing was said yet: nothing to show.
  if (!capture.inputText.trim() && capture.audioParts === 0) return null

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <section className="card source">
      <h2 className="source-heading">
        {capture.source === 'Voice' ? <IoMicOutline aria-hidden /> : <IoKeypadOutline aria-hidden />}{' '}
        {capture.source === 'Voice' ? t('source.fromVoice') : t('source.fromTyped')}
      </h2>
      <p className="muted">
        “{capture.title}” · {when}
      </p>
      {capture.summary && <p>{capture.summary}</p>}
      <details open>
        <summary>{capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}</summary>
        <p className="source-text">{capture.inputText}</p>
      </details>
      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <div className="source-audio">
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} />
          </div>
        ) : (
          <p className="muted">{t('source.audioDeleted')}</p>
        ))}
    </section>
  )
}

/**
 * The item's recording - one player for the whole message (an item is the
 * whole message: one entry per message). A recording made with pauses is
 * stored in parts; they're fetched (as blobs - audio needs the auth header)
 * and joined end to end, so play, seek and duration cover all of it.
 */
export function RecordingPlayer({ captureId, parts }: { captureId: string; parts: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [speed] = usePlaybackSpeed()

  useEffect(() => {
    let created: string | null = null
    let cancelled = false
    Promise.all(Array.from({ length: parts }, (_, part) => capturesApi.audio(captureId, part)))
      .then((blobs) => (blobs.length === 1 ? blobs[0] : toWav(blobs)))
      .then((blob) => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [captureId, parts])

  if (failed) return <p className="muted">{t('source.audioFailed')}</p>
  return (
    <div className="audio-part">
      {url ? <audio ref={speedRef(speed)} controls src={url} aria-label={t('source.recording')} /> : <span className="muted">{t('source.loadingAudio')}</span>}
      {url && <SpeedChips />}
    </div>
  )
}
