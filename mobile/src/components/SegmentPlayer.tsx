import { useAudioPlayer } from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import { usePlaybackSpeed } from '@/lib/playbackSpeed'
import type { Segment } from '@/lib/useSegmentRecorder'
import { View } from 'react-native'
import { SpeedChips } from './SpeedChips'
import { Button } from './ui'
import { t } from '@shared/i18n'

/** "Listen" for a multi-segment recording: plays the segments back to back. */
export function SegmentPlayer({ segments }: { segments: Segment[] }) {
  const player = useAudioPlayer(null)
  const [speed] = usePlaybackSpeed()
  const [index, setIndex] = useState<number | null>(null) // null = stopped
  const current = useRef<number | null>(null)
  const list = useRef(segments)

  useEffect(() => {
    list.current = segments
  }, [segments])

  // True once the current segment has been seen playing (see below).
  const live = useRef(false)
  // The speed for the next segment (read inside the status listener).
  const speedNow = useRef(speed)
  useEffect(() => {
    speedNow.current = speed
    player.setPlaybackRate(speed)
  }, [player, speed])

  // Subscribe to status events directly: didJustFinish is true for a single
  // update only, which a polled status hook can miss. replace() re-reports the
  // previous source's finish, so a finish only counts once the new segment
  // has been seen playing (a fixed delay fails for short segments at 2x).
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (current.current === null) return
      if (status.isLoaded && status.playing) live.current = true
      if (!status.didJustFinish || !live.current) return
      const next = current.current + 1
      if (next < list.current.length) {
        current.current = next
        live.current = false
        player.replace({ uri: list.current[next].uri })
        player.play()
        player.setPlaybackRate(speedNow.current)
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
    live.current = false
    player.replace({ uri: segments[0].uri })
    player.play()
    player.setPlaybackRate(speed)
    setIndex(0)
  }

  const total = Math.round(segments.reduce((s, x) => s + x.ms, 0) / 1000)
  const label =
    index === null
      ? `▶ ${t('player.listen')} (${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')})`
      : `■ ${t('player.stop')}${segments.length > 1 ? ` (${t('player.part', { part: index + 1, parts: segments.length })})` : ''}`

  return (
    <View style={{ gap: 8 }}>
      <Button title={label} onPress={toggle} disabled={segments.length === 0} accessibilityLabel={t('player.listenAria')} />
      <SpeedChips />
    </View>
  )
}
