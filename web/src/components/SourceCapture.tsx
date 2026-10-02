import { formatDateKey, formatTime, dateKey } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import type { AppendTarget } from '@shared/types'
import { useEffect, useState } from 'react'
import { IoMicOutline } from 'react-icons/io5'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from './CaptureBar'
import { toWav } from '../lib/toWav'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21 - voice capture history).
 */
export function SourceCapture({ captureId, item }: { captureId: string; item?: AppendTarget }) {
  const { zone } = useAuth()
  const [continuing, setContinuing] = useState(false)
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })
  const deleteAudio = useAction(() => capturesApi.deleteAudio(captureId))

  if (error) return null // The capture may have been removed; the item still stands on its own.
  if (!capture) return <p className="muted">{t('source.loading')}</p>

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <section className="card source">
      <h2>{capture.source === 'Voice' ? `🎤 ${t('source.fromVoice')}` : `⌨ ${t('source.fromTyped')}`}</h2>
      <p className="muted">
        “{capture.title}” · {when}
      </p>
      {capture.summary && <p>{capture.summary}</p>}
      <details open>
        <summary>{capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}</summary>
        <p className="source-text">{capture.inputText}</p>
      </details>
      {item &&
        (continuing ? (
          <CaptureBar continueFrom={{ captureId, target: item, onClose: () => setContinuing(false) }} />
        ) : (
          // Complete an unfinished thought or add an insight, even after saving.
          <button type="button" className="continue-button" onClick={() => setContinuing(true)}>
            <IoMicOutline aria-hidden /> {t('source.addMore')}
          </button>
        ))}

      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <div className="source-audio">
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} />
            <button
              className="link danger"
              disabled={deleteAudio.isPending}
              onClick={() => window.confirm(t('source.confirmDeleteAudio')) && deleteAudio.mutate(undefined)}>
              {t('source.deleteAudio')}
            </button>
          </div>
        ) : (
          <p className="muted">{t('source.audioDeleted')}</p>
        ))}
    </section>
  )
}

/**
 * The whole recording as one track, like the mobile app. A recording made with
 * pauses is stored in parts; they're fetched (as blobs - audio needs the auth
 * header) and joined end to end, so play, seek and duration cover all of it.
 */
function RecordingPlayer({ captureId, parts }: { captureId: string; parts: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

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
      {url ? <audio controls src={url} aria-label={t('source.recording')} /> : <span className="muted">{t('source.loadingAudio')}</span>}
    </div>
  )
}
