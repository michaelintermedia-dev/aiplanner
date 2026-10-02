import Ionicons from '@expo/vector-icons/Ionicons'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import type { AppendTarget } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useAudioPlayer } from 'expo-audio'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { API_URL, getAccessToken } from '@/api/client'
import { capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { Button } from './ui'

/**
 * "Where this came from": the capture an item was created from, with the
 * original words and the recording (spec section 21).
 */
export function SourceCapture({ captureId, item }: { captureId: string; item?: AppendTarget }) {
  const c = useColors()
  const [continuing, setContinuing] = useState(false)
  const { zone } = useAuth()
  const { data: capture, error } = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId) })
  const deleteAudio = useAction(() => capturesApi.deleteAudio(captureId))
  const [showText, setShowText] = useState(true)

  if (error) return null
  if (!capture) return <Text style={{ color: c.muted }}>Loading source…</Text>

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.heading, { color: c.muted }]}>
        {capture.source === 'Voice' ? '🎤 FROM A VOICE CAPTURE' : '⌨ FROM A TYPED CAPTURE'}
      </Text>
      <Text style={{ color: c.muted }}>
        “{capture.title}” · {when}
      </Text>
      {capture.summary && <Text style={{ color: c.text }}>{capture.summary}</Text>}
      <Pressable onPress={() => setShowText((s) => !s)} accessibilityRole="button">
        <Text style={{ color: c.muted }}>
          {showText ? '▾' : '▸'} {capture.source === 'Voice' ? 'Full transcription' : 'What you typed'}
        </Text>
      </Pressable>
      {showText && <Text style={[styles.text, { color: c.text, backgroundColor: c.surface2 }]}>{capture.inputText}</Text>}

      {item &&
        (continuing ? (
          <CaptureBar continueFrom={{ captureId, target: item, onClose: () => setContinuing(false) }} />
        ) : (
          // Complete an unfinished thought or add an insight, even after saving.
          <Pressable
            onPress={() => setContinuing(true)}
            style={[styles.continue, { borderColor: c.border }]}
            accessibilityRole="button">
            <Ionicons name="mic-outline" size={18} color={c.text} />
            <Text style={{ color: c.text }}>Add more - keep talking</Text>
          </Pressable>
        ))}

      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <View style={styles.audio}>
            <RecordingPlayer captureId={captureId} parts={capture.audioParts} />
            <Button
              title="Delete recording"
              variant="danger"
              disabled={deleteAudio.isPending}
              onPress={() =>
                Alert.alert('Delete the recording?', 'The transcription is kept.', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteAudio.mutate(undefined) },
                ])
              }
            />
          </View>
        ) : (
          <Text style={{ color: c.muted }}>The recording was deleted; the transcription is kept.</Text>
        ))}
    </View>
  )
}

/** Streams the recording's parts from the API (with the auth header), one after another. */
function RecordingPlayer({ captureId, parts }: { captureId: string; parts: number }) {
  const player = useAudioPlayer(null)
  const [part, setPart] = useState<number | null>(null)
  const current = useRef<number | null>(null)
  const startedAt = useRef(0)

  const play = useCallback(
    (p: number) => {
      current.current = p
      startedAt.current = Date.now()
      player.replace({
        uri: `${API_URL}/api/captures/${captureId}/audio?part=${p}`,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      player.play()
      setPart(p)
    },
    [player, captureId],
  )

  // Next part when one ends. Events rather than polled status (didJustFinish
  // lasts one update); replace() re-reports the previous finish, so ignore
  // finishes right after starting a part.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (!s.didJustFinish || current.current === null || Date.now() - startedAt.current < 300) return
      if (current.current + 1 < parts) play(current.current + 1)
      else {
        current.current = null
        setPart(null)
      }
    })
    return () => sub.remove()
  }, [player, parts, play])

  const playing = part !== null
  return (
    <Button
      title={playing ? `■ Stop${parts > 1 ? ` (part ${part + 1}/${parts})` : ''}` : `▶ Play recording${parts > 1 ? ` (${parts} parts)` : ''}`}
      onPress={() => {
        if (playing) {
          player.pause()
          current.current = null
          setPart(null)
        } else play(0)
      }}
    />
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 8 },
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  text: { padding: 10, borderRadius: 8, fontSize: 14, lineHeight: 20 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  audio: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
})
