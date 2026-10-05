import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import type { Capture, ItemType } from '@shared/types'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useHideDock } from '@/lib/dockTarget'
import { useColors } from '@/theme'
import { CaptureReview } from './CaptureReview'
import { Button } from './ui'

const PATH = { Task: '/task/[id]', Appointment: '/appointment/[id]', Note: '/note/[id]' } as const

/**
 * An item screen's view / Edit switch. `edit=1` opens Edit, `talk=1` opens it
 * recording. The floating dock is hidden while the screen is focused - the
 * mic next to Edit does "talk about this item".
 * After Save: a type change opens the new item; words that weren't about the
 * item are captured and their review shown (FollowUpReview).
 */
export function useEditMode() {
  const params = useLocalSearchParams<{ edit?: string; talk?: string; followUp?: string }>()
  const [editing, setEditing] = useState(params.edit === '1' || params.talk === '1')
  // Each new value starts recording in the Edit form.
  const [talkSignal, setTalkSignal] = useState(params.talk === '1' ? 1 : 0)
  const [followUp, setFollowUp] = useState<string | null>(params.followUp || null)

  const talk = () => {
    setEditing(true)
    setTalkSignal((n) => n + 1)
  }
  // This screen has its own mic (next to Edit): the floating dock steps aside.
  useHideDock()

  const done = (result: { moved?: { itemType: ItemType; id: string }; followUp?: string } | null) => {
    setEditing(false)
    setTalkSignal(0)
    if (result?.moved) {
      router.replace({ pathname: PATH[result.moved.itemType], params: { id: result.moved.id, ...(result.followUp ? { followUp: result.followUp } : {}) } })
    } else if (result?.followUp) setFollowUp(result.followUp)
  }

  return { editing, talkSignal, edit: () => setEditing(true), talk, done, followUp, clearFollowUp: () => setFollowUp(null) }
}

/** Edit, plus the mic shortcut: Edit with recording already on. */
export function EditButtons({ onEdit, onTalk, disabled }: { onEdit: () => void; onTalk: () => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <>
      <Button title={t('common.edit')} disabled={disabled} onPress={onEdit} />
      <Pressable
        onPress={onTalk}
        disabled={disabled}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={t('form.talk')}
        accessibilityHint={t('form.talkHint')}>
        <Ionicons name="mic" size={22} color="#fff" />
      </Pressable>
    </>
  )
}

/** Words said while editing an item that weren't about it: captured as a new entry, reviewed here. */
export function FollowUpReview({ text, onDone }: { text: string; onDone: () => void }) {
  const c = useColors()
  const [capture, setCapture] = useState<Capture | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Captured exactly once - not a query: saving the review refreshes every query,
  // which would capture the same words again.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    capturesApi.text(text).then(setCapture, (err: unknown) => setError(err instanceof Error ? err.message : t('common.error')))
  }, [text])
  if (error) return <Text style={{ color: c.danger }}>{error}</Text>
  if (!capture) return <Text style={{ color: c.muted }}>{t('capture.understanding')}</Text>
  return <CaptureReview capture={capture} onDone={onDone} />
}

/** The view says when there are unsaved changes in Edit (leaving Edit keeps them on the device). */
export function DraftNotice({ show, onContinue }: { show: boolean; onContinue: () => void }) {
  const c = useColors()
  if (!show) return null
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: c.warn, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}
      accessibilityRole="alert">
      <Text style={{ color: c.text, flex: 1 }}>{t('form.draftNotice')}</Text>
      <Button title={t('form.continueEditing')} variant="link" onPress={onContinue} />
    </View>
  )
}
