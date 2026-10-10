import Ionicons from '@expo/vector-icons/Ionicons'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { useAudioPlayer } from 'expo-audio'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, I18nManager } from 'react-native'
import { API_URL, getAccessToken } from '@/api/client'
import { capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { usePlaybackSpeed } from '@/lib/playbackSpeed'
import { useColors } from '@/theme'
import { useCardStyle } from './panel'
import { SpeedChips } from './SpeedChips'
import { Button } from './ui'
import { t } from '@shared/i18n'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21). Read and listen only -
 * adding to the item and deleting the recording are in its Edit screen.
 */
export function SourceCapture({ captureId }: { captureId: string }) {
  const c = useColors()
  const flat = useCardStyle()
  const { zone } = useAuth()
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })
  const [showText, setShowText] = useState(true)

  if (error) return null
  if (!capture) return <Text style={{ color: c.muted }}>{t('source.loading')}</Text>
  // Made for an item created by hand, and nothing was said yet: nothing to show.
  if (!capture.inputText.trim() && capture.audioParts === 0) return null

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={capture.source === 'Voice' ? 'mic-outline' : 'keypad-outline'} size={14} color={c.muted} />
        <Text style={[styles.heading, { color: c.muted }]}>
          {(capture.source === 'Voice' ? t('source.fromVoice') : t('source.fromTyped')).toUpperCase()}
        </Text>
      </View>
      <Text style={{ color: c.muted }}>
        “{capture.title}” · {when}
      </Text>
      {capture.summary && <Text style={{ color: c.text }}>{capture.summary}</Text>}
      <Pressable onPress={() => setShowText((s) => !s)} accessibilityRole="button">
        <Text style={{ color: c.muted }}>
          {showText ? '▾' : I18nManager.isRTL ? '◂' : '▸'} {capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}
        </Text>
      </Pressable>
      {showText && <Text style={[styles.text, { color: c.text, borderColor: c.border }]}>{capture.inputText}</Text>}

      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <View style={styles.audio}>
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} />
          </View>
        ) : (
          <Text style={{ color: c.muted }}>{t('source.audioDeleted')}</Text>
        ))}
    </View>
  )
}

/**
 * The item's recording - one player for the whole message (an item is the
 * whole message: one entry per message). Streams its parts from the API (with
 * the auth header), one after another.
 */
export function RecordingPlayer({ captureId, parts }: { captureId: string; parts: number }) {
  const player = useAudioPlayer(null, { updateInterval: 100 })
  const [speed] = usePlaybackSpeed()
  const [playing, setPlaying] = useState<number | null>(null)
  const current = useRef<number | null>(null)
  // True once the current file has been seen playing: until then, statuses
  // (a finish) may still belong to the previous file.
  const live = useRef(false)

  const stop = useCallback(() => {
    player.pause()
    current.current = null
    setPlaying(null)
  }, [player])

  const play = useCallback(
    (p: number) => {
      current.current = p
      live.current = false
      player.replace({
        uri: `${API_URL}/api/captures/${captureId}/audio?part=${p}`,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      player.play()
      player.setPlaybackRate(speed)
      setPlaying(p)
    },
    [player, captureId, speed],
  )

  // A new speed applies at once, also while playing.
  useEffect(() => {
    player.setPlaybackRate(speed)
  }, [player, speed])

  // Next part when one ends. Events rather than polled status (didJustFinish
  // lasts one update). replace() re-reports the previous file's finish, so
  // nothing counts until the new file is seen playing.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      const p = current.current
      if (p === null) return
      if (st.isLoaded && st.playing) live.current = true
      if (!live.current || !st.didJustFinish) return
      if (p + 1 < parts) play(p + 1)
      else stop()
    })
    return () => sub.remove()
  }, [player, parts, play, stop])

  const playLabel = `▶ ${t('player.play')}${parts > 1 ? ` (${t('player.parts', { count: parts })})` : ''}`
  const stopLabel = `■ ${t('player.stop')}${parts > 1 && playing !== null ? ` (${t('player.part', { part: playing + 1, parts })})` : ''}`
  return (
    <View style={{ gap: 8, alignItems: 'flex-start' }}>
      <Button title={playing !== null ? stopLabel : playLabel} onPress={() => (playing !== null ? stop() : play(0))} />
      <SpeedChips />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 8 },
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  // A quote (a line at its side), not a box inside the card.
  text: { paddingVertical: 2, paddingLeft: 10, borderLeftWidth: 3, fontSize: 14, lineHeight: 20 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  audio: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
})
