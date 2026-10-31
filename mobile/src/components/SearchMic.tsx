import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { File } from 'expo-file-system'
import { useState } from 'react'
import { ActivityIndicator, Pressable } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useSegmentRecorder } from '@/lib/useSegmentRecorder'
import { useColors } from '@/theme'

/**
 * The search box's mic (spec v2): tap, say what to find, tap again - the words
 * go into the search box. Speech to text only: no AI, nothing saved.
 */
export function SearchMic({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const c = useColors()
  const recorder = useSegmentRecorder()
  const [busy, setBusy] = useState(false)
  const listening = recorder.state === 'recording'

  const toggle = async () => {
    if (!listening) {
      try {
        await recorder.record()
      } catch (e) {
        onError(e instanceof Error ? e.message : t('mic.error.couldNotUse'))
      }
      return
    }
    setBusy(true)
    try {
      const segments = await recorder.finish()
      const form = new FormData()
      segments.forEach((s, i) => form.append('audio', new File(s.uri), `search-${i + 1}.m4a`))
      const { text } = await capturesApi.transcribe(form)
      if (text.trim()) onText(text.trim().replace(/[.!?]+$/, ''))
    } catch (e) {
      onError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      recorder.clear()
      setBusy(false)
    }
  }

  if (busy) return <ActivityIndicator size="small" color={c.muted} />
  return (
    <Pressable
      onPress={() => void toggle()}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: listening }}
      accessibilityLabel={listening ? t('search.listening') : t('search.voice')}>
      <Ionicons name={listening ? 'stop-circle' : 'mic-outline'} size={20} color={listening ? c.danger : c.muted} />
    </Pressable>
  )
}
