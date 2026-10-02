import { useAudioPlayer } from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import type { Segment } from '@/lib/useSegmentRecorder'
import { Button } from './ui'
import { t } from '@shared/i18n'

/** "Listen" for a multi-segment recording: plays the segments back to back. */
export function SegmentPlayer({ segments }: { segments: Segment[] }) {
  const player = useAudioPlayer(null)
  const [index, setIndex] = useState<number | null>(null) // null = stopped
  const current = useRef<number | null>(null)
  const list = useRef(segments)

  useEffect(() => {
    list.current = segments
  }, [segments])

  const startedAt = useRef(0)

  // Subscribe to status events directly: didJustFinish is true for a single
  // update only, which a polled status hook can miss. replace() re-reports the
  // previous source's finish, so ignore finishes right after starting a part
  // (recorded parts are always longer than 300 ms).
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish || current.current === null) return
      if (Date.now() - startedAt.current < 300) return
      const next = current.current + 1
      if (next < list.current.length) {
        current.current = next
        startedAt.current = Date.now()
        player.replace({ uri: list.current[next].uri })
        player.play()
        setIndex(next)
      } else {
        current.current = null
        setIndex(null)
      }
    })
    return () => sub.remove()
  }, [player])

  const toggle = () => {
    if (current.current !== null) {
      player.pause()
      current.current = null
      setIndex(null)
      return
    }
    if (segments.length === 0) return
    current.current = 0
    startedAt.current = Date.now()
    player.replace({ uri: segments[0].uri })
    player.play()
    setIndex(0)
  }

  const total = Math.round(segments.reduce((s, x) => s + x.ms, 0) / 1000)
  const label =
    index === null
      ? `▶ ${t('player.listen')} (${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')})`
      : `■ ${t('player.stop')}${segments.length > 1 ? ` (${t('player.part', { part: index + 1, parts: segments.length })})` : ''}`

  return <Button title={label} onPress={toggle} disabled={segments.length === 0} accessibilityLabel={t('player.listenAria')} />
}
