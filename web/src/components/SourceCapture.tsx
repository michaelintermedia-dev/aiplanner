import { formatDateKey, formatTime, dateKey } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import type { AppendTarget } from '@shared/types'
import { clipsLabel, itemClips, type Snippet } from '@shared/audioSnippet'
import { useEffect, useRef, useState } from 'react'
import { IoKeypadOutline, IoMicOutline, IoPlay } from 'react-icons/io5'
import { useNavigate } from 'react-router'
import { capturesApi } from '../api/endpoints'
import { itemPath } from '../lib/notifications'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from './CaptureBar'
import { toWav } from '../lib/toWav'
import { speedRef, usePlaybackSpeed } from '../lib/playbackSpeed'
import { useAction } from '../lib/useAction'
import { SpeedChips } from './SpeedChips'
import { t } from '@shared/i18n'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21 - voice capture history).
 */
export function SourceCapture({ captureId, item }: { captureId: string; item?: AppendTarget }) {
  const { zone } = useAuth()
  const [continuing, setContinuing] = useState(false)
  const navigate = useNavigate()
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })
  const deleteAudio = useAction(() => capturesApi.deleteAudio(captureId))

  if (error) return null // The capture may have been removed; the item still stands on its own.
  if (!capture) return <p className="muted">{t('source.loading')}</p>

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
      {item &&
        (continuing ? (
          <CaptureBar
            continueFrom={{
              captureId,
              target: item,
              onClose: () => setContinuing(false),
              onMoved: (moved) => navigate(itemPath(moved), { replace: true }),
            }}
          />
        ) : (
          // Complete an unfinished thought or add an insight, even after saving.
          <button type="button" className="continue-button" onClick={() => setContinuing(true)}>
            <IoMicOutline aria-hidden /> {t('source.addMore')}
          </button>
        ))}

      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <div className="source-audio">
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} clips={itemClips(capture, item)} />
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
 * When the message held several items, `clips` are this item's own parts (its
 * words, plus anything spoken when adding to it): "Play this part" plays just
 * those, one after another, and the full player is still there.
 */
function RecordingPlayer({ captureId, parts, clips }: { captureId: string; parts: number; clips: Snippet[] }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const [speed] = usePlaybackSpeed()
  // Playing this item's parts: which one, where it ends (null = play on), and
  // where we just seeked to (any other seek means the user took over).
  const clip = useRef(0)
  const stopAt = useRef<number | null>(null)
  const seekedTo = useRef<number | null>(null)
  // timeupdate fires only ~4x a second (half a second of audio at 2x): while a
  // part plays, its end is also checked every frame, so it stops on time.
  const frame = useRef<number | null>(null)

  const endOfClip = (a: HTMLAudioElement) => {
    if (stopAt.current === null || a.currentTime < stopAt.current) return
    // End of this part: on to the next one, or stop.
    if (clip.current + 1 < clips.length) playClip(clip.current + 1)
    else {
      a.pause()
      stopAt.current = null
    }
  }

  const watch = () => {
    frame.current = null
    const a = audio.current
    if (!a || a.paused || stopAt.current === null) return
    endOfClip(a)
    if (!a.paused && stopAt.current !== null) frame.current = requestAnimationFrame(watch)
  }
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  const playClip = (i: number) => {
    const a = audio.current
    if (!a || !clips[i]) return
    clip.current = i
    seekedTo.current = clips[i].startMs / 1000
    a.currentTime = clips[i].startMs / 1000
    stopAt.current = clips[i].endMs / 1000
    void a.play()
  }

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
      {url && clips.length > 0 && (
        <button type="button" className="snippet-button" onClick={() => playClip(0)}>
          <IoPlay aria-hidden /> {clipsLabel(clips)}
        </button>
      )}
      {url ? (
        <audio
          ref={(a) => {
            audio.current = a
            speedRef(speed)(a)
          }}
          controls
          src={url}
          aria-label={clips.length ? t('player.playWhole') : t('source.recording')}
          onTimeUpdate={(e) => endOfClip(e.currentTarget)}
          onPlaying={() => {
            if (frame.current === null) frame.current = requestAnimationFrame(watch)
          }}
          // Any other pause or a manual seek means the user took over: play on freely.
          onPause={() => (stopAt.current = null)}
          onSeeked={(e) => {
            if (seekedTo.current === null || Math.abs(e.currentTarget.currentTime - seekedTo.current) > 0.3) stopAt.current = null
            seekedTo.current = null
          }}
        />
      ) : (
        <span className="muted">{t('source.loadingAudio')}</span>
      )}
      {url && <SpeedChips />}
    </div>
  )
}
