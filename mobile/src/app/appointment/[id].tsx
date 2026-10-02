import { addDays, dateKey, formatDateKey, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import { describeReminder, remindersProblem } from '@shared/reminders'
import type { Appointment, Reminder } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { appointmentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { DateTimeField } from '@/components/DateTimeField'
import { detailStyles as s, Facts, Field, TextBlock } from '@/components/detail'
import { ReminderList } from '@/components/ReminderList'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { Badge, Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { zone } = useAuth()
  const [editing, setEditing] = useState(false)
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: appt, isPending, error } = useQuery({ queryKey: ['appointment', id], queryFn: () => appointmentsApi.get(id), enabled: !deleting })

  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const reopen = useAction(appointmentsApi.reopen)
  const remove = useAction(appointmentsApi.remove)
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <Screen><Text style={{ color: c.muted }}>Loading…</Text></Screen>
  if (error || !appt) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? 'Appointment not found.'}</Text></Screen>

  const closed = appt.status !== 'Scheduled'
  const passed = eventPassed(appt)

  const confirmDelete = () =>
    Alert.alert('Delete appointment?', appt.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(appt.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Edit appointment' : 'Appointment' }} />
      {editing ? (
        <AppointmentEditForm appt={appt} onDone={() => setEditing(false)} />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.appointment }]}>APPOINTMENT</Text>
            <Text style={[s.title, { color: closed ? c.muted : c.text }, closed && s.struck]}>{appt.title}</Text>
            <View style={s.badges}>
              {passed ? (
                <Badge label="Passed" />
              ) : (
                <Badge label={appt.status} color={appt.status === 'Completed' ? c.task : appt.status === 'Cancelled' ? c.danger : undefined} />
              )}
            </View>
          </View>

          <Facts
            rows={[
              ['When', `${formatDateKey(dateKey(appt.startUtc, zone.timeZone), zone.locale, { weekday: 'long', month: 'long', day: 'numeric' })}\n${formatTime(appt.startUtc, zone)} – ${formatTime(appt.endUtc, zone)}`],
              ...(appt.location ? [['Where', appt.location] as [string, string]] : []),
              ...(appt.participants.length ? [['With', appt.participants.map((p) => p.name).join(', ')] as [string, string]] : []),
              ['Reminders', appt.reminders?.length ? appt.reminders.map((r) => describeReminder(r, zone)).join(' · ') : 'None'],
            ]}
          />

          <TextBlock title="Description" text={appt.description} />
          <TextBlock title="Notes" text={appt.notes} />

          {actionError && <Text style={{ color: c.danger }}>{actionError.message}</Text>}
          <View style={s.actions}>
            {closed ? (
              <Button title="↺ Reopen" variant="primary" busy={reopen.isPending} disabled={busy} onPress={() => reopen.mutate(appt.id)} />
            ) : (
              <>
                <Button title="✓ Done" variant="primary" busy={complete.isPending} disabled={busy} onPress={() => complete.mutate(appt.id)} />
                <Button title="Cancel appointment" disabled={busy} onPress={() => cancel.mutate(appt.id)} />
              </>
            )}
            <Button title="Edit / reschedule" disabled={busy} onPress={() => setEditing(true)} />
            <Button title="Delete" variant="danger" disabled={busy} onPress={confirmDelete} />
          </View>
        </>
      )}

      {appt.sourceCaptureId && <SourceCapture captureId={appt.sourceCaptureId} item={{ itemType: 'Appointment', itemId: appt.id, title: appt.title }} />}
    </Screen>
  )
}

function AppointmentEditForm({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const c = useColors()
  const { zone } = useAuth()
  const update = useAction((body: Parameters<typeof appointmentsApi.update>[1]) => appointmentsApi.update(appt.id, body))
  const [title, setTitle] = useState(appt.title)
  const [date, setDate] = useState<string | null>(dateKey(appt.startUtc, zone.timeZone))
  const [start, setStart] = useState<string | null>(timeKey(appt.startUtc, zone.timeZone))
  const [end, setEnd] = useState<string | null>(timeKey(appt.endUtc, zone.timeZone))
  const [location, setLocation] = useState(appt.location ?? '')
  const [people, setPeople] = useState(appt.participants.map((p) => p.name).join(', '))
  const [reminders, setReminders] = useState<Reminder[]>(appt.reminders ?? [])
  const reminderIssue = remindersProblem(reminders, { itemHasTime: true, isNote: false })
  const [description, setDescription] = useState(appt.description ?? '')
  const [notes, setNotes] = useState(appt.notes ?? '')

  const save = () => {
    if (!date || !start || !end) return
    const startUtc = zonedToUtc(date, start, zone.timeZone)
    let endUtc = zonedToUtc(date, end, zone.timeZone)
    if (endUtc <= startUtc) endUtc = zonedToUtc(addDays(date, 1), end, zone.timeZone) // ends after midnight
    update.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        startUtc,
        endUtc,
        location: location.trim() || null,
        participantNames: people.split(',').map((p) => p.trim()).filter(Boolean),
        reminders,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <View style={s.form}>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <View style={s.chips}>
        <DateTimeField mode="date" value={date} onChange={setDate} placeholder="Date" />
        <DateTimeField mode="time" value={start} onChange={setStart} placeholder="Start" date={date} />
        <DateTimeField mode="time" value={end} onChange={setEnd} placeholder="End" date={date} prefix="until" />
      </View>
      <ReminderList value={reminders} onChange={setReminders} itemHasTime />
      <Field label="Location" value={location} onChangeText={setLocation} />
      <Field label="With (comma-separated)" value={people} onChangeText={setPeople} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {update.error && <Text style={{ color: c.danger }}>{update.error.message}</Text>}
      <View style={s.actions}>
        <Button title="Cancel" onPress={onDone} />
        <Button title="Save changes" variant="primary" busy={update.isPending} disabled={!title.trim() || !date || !start || !end || !!reminderIssue} onPress={save} />
      </View>
    </View>
  )
}
