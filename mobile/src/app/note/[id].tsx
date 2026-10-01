import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { notesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { detailStyles as s, Field } from '@/components/detail'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
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
  const update = useAction((body: { title: string | null; content: string }) => notesApi.update(id, body))
  const remove = useAction(notesApi.remove)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  if (isPending) return <Screen><Text style={{ color: c.muted }}>Loading…</Text></Screen>
  if (error || !note) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? 'Note not found.'}</Text></Screen>

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(utc, zone)}`

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
          {update.error && <Text style={{ color: c.danger }}>{update.error.message}</Text>}
          <View style={s.actions}>
            <Button title="Cancel" onPress={() => setEditing(false)} />
            <Button
              title="Save changes"
              variant="primary"
              busy={update.isPending}
              disabled={!content.trim()}
              onPress={() => update.mutate({ title: title.trim() || null, content: content.trim() }, { onSuccess: () => setEditing(false) })}
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
