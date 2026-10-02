import { formatDateKey, formatTime, dateKey } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { toWav } from '../lib/toWav'
import { useAction } from '../lib/useAction'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21 - voice capture history).
 */
export function SourceCapture({ captureId }: { captureId: string }) {
  const { zone } = useAuth()
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })
  const deleteAudio = useAction(() => capturesApi.deleteAudio(captureId))

  if (error) return null // The capture may have been removed; the item still stands on its own.
  if (!capture) return <p className="muted">Loading source…</p>

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <section className="card source">
      <h2>{capture.source === 'Voice' ? '🎤 From a voice capture' : '⌨ From a typed capture'}</h2>
      <p className="muted">
        “{capture.title}” · {when}
      </p>
      {capture.summary && <p>{capture.summary}</p>}
      <details open>
        <summary>{capture.source === 'Voice' ? 'Full transcription' : 'What you typed'}</summary>
        <p className="source-text">{capture.inputText}</p>
      </details>
      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <div className="source-audio">
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} />
            <button
              className="link danger"
              disabled={deleteAudio.isPending}
              onClick={() => window.confirm('Delete the recording? The transcription is kept.') && deleteAudio.mutate(undefined)}>
              Delete recording
            </button>
          </div>
        ) : (
          <p className="muted">The recording was deleted; the transcription is kept.</p>
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

  if (failed) return <p className="muted">Couldn’t load the recording.</p>
  return (
    <div className="audio-part">
      {url ? <audio controls src={url} aria-label="Recording" /> : <span className="muted">Loading recording…</span>}
    </div>
  )
}
