import Ionicons from '@expo/vector-icons/Ionicons'
import { dateKey, formatDateKey, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import type { SaveNoteRequest } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { notesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { detailStyles as s, Field } from '@/components/detail'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { DateTimeField } from '@/components/DateTimeField'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { zone } = useAuth()
  const [editing, setEditing] = useState(false)
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: note, isPending, error } = useQuery({ queryKey: ['note', id], queryFn: () => notesApi.get(id), enabled: !deleting })
  const update = useAction((body: SaveNoteRequest) => notesApi.update(id, body))
  const remove = useAction(notesApi.remove)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [remindDate, setRemindDate] = useState<string | null>(null)
  const [remindTime, setRemindTime] = useState<string | null>(null)

  if (isPending) return <Screen><Text style={{ color: c.muted }}>Loading…</Text></Screen>
  if (error || !note) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? 'Note not found.'}</Text></Screen>

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(utc, zone)}`

  const halfReminder = !!remindDate !== !!remindTime

  // PUT replaces the note, so the reminder is always sent (null = none).
  const save = () =>
    update.mutate(
      {
        title: title.trim() || null,
        content: content.trim(),
        reminderAtUtc: remindDate && remindTime ? zonedToUtc(remindDate, remindTime, zone.timeZone) : null,
      },
      { onSuccess: () => setEditing(false) },
    )

  const confirmDelete = () =>
    Alert.alert('Delete note?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(note.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Edit note' : 'Note' }} />
      {editing ? (
        <View style={s.form}>
          <Field label="Title (optional)" value={title} onChangeText={setTitle} />
          <Field label="Note" value={content} onChangeText={setContent} multiline />
          <Text style={{ color: c.muted }}>Remind me (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <DateTimeField mode="date" value={remindDate} onChange={setRemindDate} placeholder="Date" />
            <DateTimeField mode="time" value={remindTime} onChange={setRemindTime} placeholder="Time" date={remindDate} />
          </View>
          {halfReminder && <Text style={{ color: c.danger }}>Pick both a date and a time for the reminder, or clear both.</Text>}
          {update.error && <Text style={{ color: c.danger }}>{update.error.message}</Text>}
          <View style={s.actions}>
            <Button title="Cancel" onPress={() => setEditing(false)} />
            <Button
              title="Save changes"
              variant="primary"
              busy={update.isPending}
              disabled={!content.trim() || halfReminder}
              onPress={save}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.warn }]}>NOTE</Text>
            {note.title && note.title !== note.content && <Text style={[s.title, { color: c.text }]}>{note.title}</Text>}
          </View>
          <Text style={{ color: c.text, fontSize: 17, lineHeight: 25 }} selectable>
            {note.content}
          </Text>
          {note.reminderAtUtc && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="notifications-outline" size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 15 }}>Remind me {when(note.reminderAtUtc)}</Text>
            </View>
          )}
          <Text style={{ color: c.muted, fontSize: 13 }}>
            Created {when(note.createdAtUtc)}
            {note.updatedAtUtc !== note.createdAtUtc ? ` · edited ${when(note.updatedAtUtc)}` : ''}
          </Text>
          {remove.error && <Text style={{ color: c.danger }}>{remove.error.message}</Text>}
          <View style={s.actions}>
            <Button
              title="Edit"
              variant="primary"
              onPress={() => {
                setTitle(note.title ?? '')
                setContent(note.content)
                setRemindDate(note.reminderAtUtc ? dateKey(note.reminderAtUtc, zone.timeZone) : null)
                setRemindTime(note.reminderAtUtc ? timeKey(note.reminderAtUtc, zone.timeZone) : null)
                setEditing(true)
              }}
            />
            <Button title="Delete" variant="danger" disabled={remove.isPending} onPress={confirmDelete} />
          </View>
        </>
      )}

      {note.sourceCaptureId && <SourceCapture captureId={note.sourceCaptureId} />}
    </Screen>
  )
}
