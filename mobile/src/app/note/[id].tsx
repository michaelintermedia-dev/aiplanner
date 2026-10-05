import { noteName } from '@shared/feed'
import Ionicons from '@expo/vector-icons/Ionicons'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { formFromNote } from '@shared/itemForm'
import { describeReminder, repeats } from '@shared/reminders'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { notesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { detailStyles as s } from '@/components/detail'
import { DraftNotice, EditButtons, FollowUpReview, useEditMode } from '@/components/ItemEditMode'
import { hasEditDraft, ItemEditor } from '@/components/ItemEditor'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { zone } = useAuth()
  // Everything that changes the note happens in Edit (`edit=1` / `talk=1` open it; so does the floating mic).
  const edit = useEditMode()
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: note, isPending, error } = useQuery({ queryKey: ['note', id], queryFn: () => notesApi.get(id), enabled: !deleting })
  const remove = useAction(notesApi.remove)

  if (isPending) return <Screen><Text style={{ color: c.muted }}>{t('common.loading')}</Text></Screen>
  if (error || !note) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? t('note.notFound')}</Text></Screen>

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(utc, zone)}`

  const confirmDelete = () =>
    Alert.alert(t('note.confirmDelete'), undefined, [
      { text: t('changeType.keep'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(note.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: edit.editing ? t('common.edit') : t('kind.note') }} />
      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      <DraftNotice show={!edit.editing && hasEditDraft(note.id, formFromNote(note))} onContinue={edit.edit} />
      {edit.editing ? (
        <ItemEditor
          item={{ itemType: 'Note', id: note.id, title: noteName(note) }}
          saved={formFromNote(note)}
          captureId={note.sourceCaptureId}
          talkSignal={edit.talkSignal}
          onDone={edit.done}
        />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.warn }]}>{t('kind.note').toUpperCase()}</Text>
            {note.title && note.title !== note.content && <Text style={[s.title, { color: c.text }]}>{note.title}</Text>}
          </View>
          <Text style={{ color: c.text, fontSize: 17, lineHeight: 25 }} selectable>
            {note.content}
          </Text>
          {note.reminders.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={repeats(r) ? 'repeat' : 'notifications-outline'} size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 15 }}>{t('note.remindMe', { reminder: describeReminder(r, zone) })}</Text>
            </View>
          ))}
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {t('note.created', { when: when(note.createdAtUtc) })}
            {note.updatedAtUtc !== note.createdAtUtc ? ` · ${t('note.edited', { when: when(note.updatedAtUtc) })}` : ''}
          </Text>
          {remove.error && <Text style={{ color: c.danger }}>{remove.error.message}</Text>}
          <View style={s.actions}>
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} />
            <Button title={t('common.delete')} variant="danger" disabled={remove.isPending} onPress={confirmDelete} />
          </View>
        </>
      )}

      {!edit.editing && note.sourceCaptureId && <SourceCapture captureId={note.sourceCaptureId} item={{ itemType: 'Note', itemId: note.id, title: noteName(note) }} />}
    </Screen>
  )
}
