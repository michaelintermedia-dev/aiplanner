import Ionicons from '@expo/vector-icons/Ionicons'
import { clipsLabel, itemClips, locateInParts, partStartsMs, type Snippet } from '@shared/audioSnippet'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import type { AppendTarget } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useAudioPlayer } from 'expo-audio'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View, I18nManager } from 'react-native'
import { API_URL, getAccessToken } from '@/api/client'
import { capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { usePlaybackSpeed } from '@/lib/playbackSpeed'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { SpeedChips } from './SpeedChips'
import { Button } from './ui'
import { t } from '@shared/i18n'

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
  if (!capture) return <Text style={{ color: c.muted }}>{t('source.loading')}</Text>

  const when = `${formatDateKey(dateKey(capture.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(capture.createdAtUtc, zone)}`

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.heading, { color: c.muted }]}>
        {capture.source === 'Voice' ? `🎤 ${t('source.fromVoice').toUpperCase()}` : `⌨ ${t('source.fromTyped').toUpperCase()}`}
      </Text>
      <Text style={{ color: c.muted }}>
        “{capture.title}” · {when}
      </Text>
      {capture.summary && <Text style={{ color: c.text }}>{capture.summary}</Text>}
      <Pressable onPress={() => setShowText((s) => !s)} accessibilityRole="button">
        <Text style={{ color: c.muted }}>
          {showText ? '▾' : I18nManager.isRTL ? '◂' : '▸'} {capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}
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
            <Text style={{ color: c.text }}>{t('source.addMore')}</Text>
          </Pressable>
        ))}

      {capture.source === 'Voice' &&
        (capture.audioParts > 0 ? (
          <View style={styles.audio}>
            <RecordingPlayer
              captureId={captureId}
              parts={capture.audioParts}
              durationsMs={capture.audioPartDurationsMs ?? null}
              clips={itemClips(capture, item)}
            />
            <Button
              title={t('source.deleteAudio')}
              variant="danger"
              disabled={deleteAudio.isPending}
              onPress={() =>
                Alert.alert(t('source.confirmDeleteAudioTitle'), t('source.transcriptionKept'), [
                  { text: t('changeType.keep'), style: 'cancel' },
                  { text: t('common.delete'), style: 'destructive', onPress: () => deleteAudio.mutate(undefined) },
                ])
              }
            />
          </View>
        ) : (
          <Text style={{ color: c.muted }}>{t('source.audioDeleted')}</Text>
        ))}
    </View>
  )
}

/**
 * Streams the recording's parts from the API (with the auth header), one after
 * another. When the message held several items, `clips` are this item's own
 * parts (its words, plus anything spoken when adding to it): "Play this part"
 * plays them in order - starting in the right file at the right moment and
 * stopping at each one's end, even across files.
 */
function RecordingPlayer({
  captureId,
  parts,
  durationsMs,
  clips,
}: {
  captureId: string
  parts: number
  durationsMs: number[] | null
  clips: Snippet[]
}) {
  // Frequent position updates, so a part stops close to its end (even at 2x).
  const player = useAudioPlayer(null, { updateInterval: 100 })
  const [speed] = usePlaybackSpeed()
  const [playing, setPlaying] = useState<{ part: number; snippet: boolean } | null>(null)
  const current = useRef<number | null>(null)
  // True once the current file has been seen playing: until then, statuses
  // (a finish, a position) may still belong to the previous file.
  const live = useRef(false)
  // Seek once the part has loaded (seeking before that is ignored).
  const pendingSeekMs = useRef(0)
  // Stop here (ms on the whole-recording timeline) - playing the item's parts.
  const stopAtMs = useRef<number | null>(null)
  const clip = useRef(0)
  // Snippets need every part's length to find their place; otherwise only the whole recording.
  const canSnip = clips.length > 0 && (parts === 1 || durationsMs?.length === parts)
  const starts = useMemo(() => (durationsMs?.length === parts ? partStartsMs(durationsMs) : [0]), [durationsMs, parts])

  const stop = useCallback(() => {
    player.pause()
    current.current = null
    stopAtMs.current = null
    setPlaying(null)
  }, [player])

  const play = useCallback(
    (p: number, seekMs = 0, asSnippet = false) => {
      current.current = p
      live.current = false
      pendingSeekMs.current = seekMs
      player.replace({
        uri: `${API_URL}/api/captures/${captureId}/audio?part=${p}`,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      player.play()
      player.setPlaybackRate(speed)
      setPlaying({ part: p, snippet: asSnippet })
    },
    [player, captureId, speed],
  )

  // A new speed applies at once, also while playing.
  useEffect(() => {
    player.setPlaybackRate(speed)
  }, [player, speed])

  const playClip = useCallback(
    (i: number) => {
      const c = clips[i]
      if (!c) return
      clip.current = i
      const at = durationsMs?.length === parts ? locateInParts(durationsMs, c.startMs) : { part: 0, offsetMs: c.startMs }
      stopAtMs.current = c.endMs
      play(at.part, at.offsetMs, true)
    },
    [clips, durationsMs, parts, play],
  )

  // Next part when one ends. Events rather than polled status (didJustFinish
  // lasts one update). replace() re-reports the previous file's finish, so
  // nothing counts until the new file is seen playing - not a fixed delay,
  // which a short piece at 2x can finish within.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      const p = current.current
      if (p === null) return
      if (pendingSeekMs.current > 0 && st.isLoaded) {
        void player.seekTo(pendingSeekMs.current / 1000)
        pendingSeekMs.current = 0
        return
      }
      if (st.isLoaded && st.playing && pendingSeekMs.current === 0) live.current = true
      if (!live.current) return
      if (stopAtMs.current !== null && st.isLoaded && (starts[p] ?? 0) + st.currentTime * 1000 >= stopAtMs.current) {
        // End of this part of the item: on to the next one, or stop.
        if (clip.current + 1 < clips.length) playClip(clip.current + 1)
        else stop()
        return
      }
      if (!st.didJustFinish) return
      if (p + 1 < parts) play(p + 1, 0, stopAtMs.current !== null)
      else stop()
    })
    return () => sub.remove()
  }, [player, parts, play, stop, starts, clips.length, playClip])

  const wholeLabel = `▶ ${t('player.play')}${parts > 1 ? ` (${t('player.parts', { count: parts })})` : ''}`
  const stopLabel = `■ ${t('player.stop')}${parts > 1 && playing ? ` (${t('player.part', { part: playing.part + 1, parts })})` : ''}`
  return (
    <View style={{ gap: 8, alignItems: 'flex-start' }}>
      {canSnip && (
        <Button
          title={playing?.snippet ? stopLabel : `▶ ${clipsLabel(clips)}`}
          variant={playing?.snippet ? 'default' : 'primary'}
          onPress={() => (playing ? stop() : playClip(0))}
        />
      )}
      <Button
        title={playing && !playing.snippet ? stopLabel : canSnip ? `▶ ${t('player.playWhole')}` : wholeLabel}
        onPress={() => (playing ? stop() : play(0))}
      />
      <SpeedChips />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 8 },
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  text: { padding: 10, borderRadius: 8, fontSize: 14, lineHeight: 20 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  audio: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
})
