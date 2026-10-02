import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useCallback, useRef, useState } from 'react'
import { t } from '@shared/i18n'

export type RecorderState = 'idle' | 'recording' | 'paused'

export interface Segment {
  uri: string
  ms: number
}

const MAX_MS = 10 * 60 * 1000

/**
 * Records voice as a series of segments. Every pause *stops* the native
 * recorder, which finalizes a complete .m4a file - a paused-but-unfinished
 * file can't be played on a phone, and "listen before sending" needs that.
 * Continuing starts the next segment. The API accepts all segments in one
 * upload and joins their transcripts in order.
 */
export function useSegmentRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true })
  const status = useAudioRecorderState(recorder, 100)
  const [state, setState] = useState<RecorderState>('idle')
  const [segments, setSegments] = useState<Segment[]>([])
  const busy = useRef(false)

  const recordedMs = segments.reduce((sum, s) => sum + s.ms, 0)
  const currentMs = state === 'recording' ? status.durationMillis : 0
  const totalMs = recordedMs + currentMs

  /** Starts recording, or continues after a pause with a new segment. */
  const record = useCallback(async () => {
    if (busy.current || state === 'recording' || recordedMs >= MAX_MS) return
    busy.current = true
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        throw new Error(t('mic.error.permission'))
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setState('recording')
    } finally {
      busy.current = false
    }
  }, [recorder, state, recordedMs])

  /** Pauses by finishing the current segment. */
  const pause = useCallback(async () => {
    if (busy.current || state !== 'recording') return
    busy.current = true
    try {
      const ms = status.durationMillis
      await recorder.stop()
      const uri = recorder.uri
      if (uri && ms > 300) setSegments((s) => [...s, { uri, ms }]) // ignore accidental blips
      setState('paused')
      // Route playback (the preview) to the speaker, not the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    } finally {
      busy.current = false
    }
  }, [recorder, state, status.durationMillis])

  /**
   * Stops recording (if running) and returns all segments, in order. The
   * recording is kept (paused) until clear() - a failed upload must never lose
   * what the user said.
   */
  const finish = useCallback(async (): Promise<Segment[]> => {
    if (state !== 'recording') return segments
    const ms = status.durationMillis
    await recorder.stop()
    const last = recorder.uri && ms > 300 ? [{ uri: recorder.uri, ms }] : []
    const all = [...segments, ...last]
    setSegments(all)
    setState('paused')
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    return all
  }, [recorder, segments, state, status.durationMillis])

  /** Forgets the recording after it was sent successfully. */
  const clear = useCallback(() => {
    setSegments([])
    setState('idle')
  }, [])

  const discard = useCallback(async () => {
    if (state === 'recording') await recorder.stop()
    setSegments([])
    setState('idle')
  }, [recorder, state])

  return {
    state,
    segments,
    seconds: Math.floor(totalMs / 1000),
    atLimit: totalMs >= MAX_MS,
    /** Input level in dBFS while recording (about -160 silent .. 0 loudest). */
    metering: state === 'recording' ? status.metering : undefined,
    record,
    pause,
    finish,
    clear,
    discard,
  }
}
