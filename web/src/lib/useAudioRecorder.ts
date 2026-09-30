import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'unsupported'

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
 * Records microphone audio with MediaRecorder. start() asks for mic permission
 * the first time; stop() resolves with the finished recording.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>(() => (pickFormat() ? 'idle' : 'unsupported'))
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
    recorder.current = null
  }, [])

  useEffect(() => release, [release])

  const start = useCallback(async () => {
    const format = pickFormat()
    if (!format) throw new Error('This browser cannot record audio.')
    // Throws NotAllowedError if the user blocks the microphone.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const r = new MediaRecorder(stream, { mimeType: format.mimeType })
    chunks.current = []
    r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
    r.start()
    recorder.current = r
    setSeconds(0)
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    setState('recording')
  }, [])

  const stop = useCallback(
    () =>
      new Promise<Recording>((resolve, reject) => {
        const r = recorder.current
        const format = pickFormat()
        if (!r || !format) return reject(new Error('Not recording.'))
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

  const cancel = useCallback(() => {
    if (recorder.current) recorder.current.onstop = null
    recorder.current?.stop()
    release()
    setState('idle')
  }, [release])

  return { state, seconds, start, stop, cancel }
}
