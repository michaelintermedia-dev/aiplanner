import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * idle: nothing recorded. recording: mic is live. paused: there is audio that
 * can be continued (resume) or finished (stop). unsupported: no MediaRecorder.
 */
export type RecorderState = 'idle' | 'recording' | 'paused' | 'unsupported'

export interface Recording {
  blob: Blob
  /** File name with an extension the API accepts (webm on Chrome/Firefox, m4a on Safari). */
  fileName: string
}

/** Pick a format the browser can record that the API also accepts. */
function pickFormat(): { mimeType: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null
}

/**
 * Records microphone audio with MediaRecorder. A recording can be paused and
 * continued any number of times; stop() finishes it and resolves with one file.
 * `seconds` counts recorded time only (paused time is excluded).
 */
export function useAudioRecorder({ maxSeconds = 10 * 60 }: { maxSeconds?: number } = {}) {
  const [state, setState] = useState<RecorderState>(() => (pickFormat() ? 'idle' : 'unsupported'))
  const [seconds, setSeconds] = useState(0)
  /** Increments on every pause, so per-pause data (the preview) can tell pauses apart. */
  const [pauseCount, setPauseCount] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsed = useRef(0)

  const stopTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])

  const markPaused = useCallback(() => {
    stopTimer()
    setState('paused')
    setPauseCount((n) => n + 1)
  }, [stopTimer])

  const startTimer = useCallback(() => {
    stopTimer()
    timer.current = setInterval(() => {
      elapsed.current += 1
      setSeconds(elapsed.current)
      // Uploads are WAV (~1.9 MB/min) and the API accepts 25 MB: pause at the cap.
      if (elapsed.current >= maxSeconds && recorder.current?.state === 'recording') {
        recorder.current.pause()
        markPaused()
      }
    }, 1000)
  }, [stopTimer, markPaused, maxSeconds])

  const release = useCallback(() => {
    stopTimer()
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    recorder.current = null
  }, [stopTimer])

  useEffect(() => release, [release])

  /** Starts a new recording, or continues a paused one from where it stopped. */
  const record = useCallback(async () => {
    const r = recorder.current
    if (r?.state === 'paused') {
      if (elapsed.current >= maxSeconds) return // at the cap: send or discard

      r.resume()
      startTimer()
      setState('recording')
      return
    }
    if (r) return // already recording

    const format = pickFormat()
    if (!format) throw new Error('This browser cannot record audio.')
    // Throws NotAllowedError if the user blocks the microphone.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const created = new MediaRecorder(stream, { mimeType: format.mimeType })
    chunks.current = []
    created.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
    created.start()
    recorder.current = created
    elapsed.current = 0
    setSeconds(0)
    startTimer()
    setState('recording')
  }, [startTimer, maxSeconds])

  /** Pauses without finishing; record() continues the same recording. */
  const pause = useCallback(() => {
    const r = recorder.current
    if (r?.state !== 'recording') return
    r.pause()
    markPaused()
  }, [markPaused])

  /**
   * Everything recorded so far, as one playable file, without ending the
   * recording (used for "listen before sending"). requestData() flushes the
   * recorder's buffer into a dataavailable event; the first chunk carries the
   * container header, so all chunks joined are a valid file.
   */
  const snapshot = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const r = recorder.current
        const format = pickFormat()
        if (!r || !format || r.state === 'inactive') return resolve(null)
        const done = () => {
          r.removeEventListener('dataavailable', done)
          // Resolve after ondataavailable has pushed the flushed chunk.
          setTimeout(() => resolve(new Blob(chunks.current, { type: r.mimeType || format.mimeType })), 0)
        }
        r.addEventListener('dataavailable', done)
        r.requestData()
      }),
    [],
  )

  /** Finishes the recording (from recording or paused) and returns the audio. */
  const stop = useCallback(
    () =>
      new Promise<Recording>((resolve, reject) => {
        const r = recorder.current
        const format = pickFormat()
        if (!r || !format) return reject(new Error('Nothing recorded.'))
        r.onstop = () => {
          const blob = new Blob(chunks.current, { type: r.mimeType || format.mimeType })
          release()
          setState('idle')
          resolve({ blob, fileName: `recording.${format.extension}` })
        }
        r.stop()
      }),
    [release],
  )

  /** Throws the recording away. */
  const discard = useCallback(() => {
    const r = recorder.current
    if (r) {
      r.onstop = null
      if (r.state !== 'inactive') r.stop()
    }
    release()
    chunks.current = []
    elapsed.current = 0
    setSeconds(0)
    setState('idle')
  }, [release])

  return { state, seconds, pauseCount, atLimit: seconds >= maxSeconds, record, pause, stop, discard, snapshot }
}
