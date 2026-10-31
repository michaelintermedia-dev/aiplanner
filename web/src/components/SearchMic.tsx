import { t } from '@shared/i18n'
import { useState } from 'react'
import { IoMicOutline, IoStop } from 'react-icons/io5'
import { capturesApi } from '../api/endpoints'
import { toWav } from '../lib/toWav'
import { useAudioRecorder } from '../lib/useAudioRecorder'

/**
 * The search box's mic (spec v2): tap, say what to find, tap again - the words
 * go into the search box. Speech to text only: no AI, nothing saved.
 */
export function SearchMic({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder({ maxSeconds: 30 })
  const [busy, setBusy] = useState(false)
  const listening = recorder.state === 'recording'
  if (recorder.state === 'unsupported') return null

  const toggle = async () => {
    if (!listening) {
      try {
        await recorder.record()
      } catch {
        onError(t('mic.error.blocked'))
      }
      return
    }
    setBusy(true)
    try {
      const recording = await recorder.stop()
      const form = new FormData()
      form.append('audio', await toWav(recording.blob), 'search.wav')
      const { text } = await capturesApi.transcribe(form)
      if (text.trim()) onText(text.trim().replace(/[.!?]+$/, ''))
    } catch (e) {
      onError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`icon-button search-mic${listening ? ' listening' : ''}`}
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={listening}
      aria-label={listening ? t('search.listening') : t('search.voice')}
      title={listening ? t('search.listening') : t('search.voice')}>
      {listening ? <IoStop aria-hidden /> : <IoMicOutline aria-hidden />}
    </button>
  )
}
