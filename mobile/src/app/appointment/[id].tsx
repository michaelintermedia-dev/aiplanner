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
import { ChangeType } from '@/components/ChangeType'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { Badge, Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'
import { statusLabel } from '@shared/labels'

export default function AppointmentDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>()
  const c = useColors()
  const { zone } = useAuth()
  // `edit=1`: just changed into an event and its time was guessed - check it.
  const [editing, setEditing] = useState(edit === '1')
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: appt, isPending, error } = useQuery({ queryKey: ['appointment', id], queryFn: () => appointmentsApi.get(id), enabled: !deleting })

  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const reopen = useAction(appointmentsApi.reopen)
  const remove = useAction(appointmentsApi.remove)
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <Screen><Text style={{ color: c.muted }}>{t('common.loading')}</Text></Screen>
  if (error || !appt) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? t('event.notFound')}</Text></Screen>

  const closed = appt.status !== 'Scheduled'
  const passed = eventPassed(appt)

  const confirmDelete = () =>
    Alert.alert(t('event.confirmDelete'), appt.title, [
      { text: t('changeType.keep'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(appt.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? t('event.edit') : t('kind.event') }} />
      {editing ? (
        <AppointmentEditForm appt={appt} onDone={() => setEditing(false)} />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.appointment }]}>{t('kind.event').toUpperCase()}</Text>
            <Text style={[s.title, { color: closed || passed ? c.muted : c.text }, (closed || passed) && s.struck]}>{appt.title}</Text>
            <View style={s.badges}>
              {passed ? (
                <Badge label={t('status.passed')} />
              ) : (
                <Badge label={statusLabel(appt.status)} color={appt.status === 'Completed' ? c.task : appt.status === 'Cancelled' ? c.danger : undefined} />
              )}
            </View>
          </View>
          <ChangeType itemType="Appointment" id={appt.id} />

          <Facts
            rows={[
              [t('event.when'), `${formatDateKey(dateKey(appt.startUtc, zone.timeZone), zone.locale, { weekday: 'long', month: 'long', day: 'numeric' })}\n${formatTime(appt.startUtc, zone)} – ${formatTime(appt.endUtc, zone)}`],
              ...(appt.location ? [[t('event.where'), appt.location] as [string, string]] : []),
              ...(appt.participants.length ? [[t('event.with'), appt.participants.map((p) => p.name).join(', ')] as [string, string]] : []),
              [t('filter.reminders'), appt.reminders?.length ? appt.reminders.map((r) => describeReminder(r, zone)).join(' · ') : t('item.none')],
            ]}
          />

          <TextBlock title={t('item.description')} text={appt.description} />
          <TextBlock title={t('item.notes')} text={appt.notes} />

          {actionError && <Text style={{ color: c.danger }}>{actionError.message}</Text>}
          <View style={s.actions}>
            {closed ? (
              <Button title={`↺ ${t('item.reopen')}`} variant="primary" busy={reopen.isPending} disabled={busy} onPress={() => reopen.mutate(appt.id)} />
            ) : (
              <>
                <Button title={`✓ ${t('common.done')}`} variant="primary" busy={complete.isPending} disabled={busy} onPress={() => complete.mutate(appt.id)} />
                <Button title={t('event.cancel')} disabled={busy} onPress={() => cancel.mutate(appt.id)} />
              </>
            )}
            <Button title={t('event.editReschedule')} disabled={busy} onPress={() => setEditing(true)} />
            <Button title={t('common.delete')} variant="danger" disabled={busy} onPress={confirmDelete} />
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
      <Field label={t('item.title')} value={title} onChangeText={setTitle} />
      <View style={s.chips}>
        <DateTimeField mode="date" value={date} onChange={setDate} placeholder={t('item.date')} />
        <DateTimeField mode="time" value={start} onChange={setStart} placeholder={t('event.start')} date={date} />
        <DateTimeField mode="time" value={end} onChange={setEnd} placeholder={t('event.end')} date={date} prefix={t('event.until')} />
      </View>
      <ReminderList value={reminders} onChange={setReminders} itemHasTime />
      <Field label={t('event.location')} value={location} onChangeText={setLocation} />
      <Field label={`${t('event.with')} ${t('item.commaSeparated')}`} value={people} onChangeText={setPeople} />
      <Field label={t('item.description')} value={description} onChangeText={setDescription} multiline />
      <Field label={t('item.notes')} value={notes} onChangeText={setNotes} multiline />
      {update.error && <Text style={{ color: c.danger }}>{update.error.message}</Text>}
      <View style={s.actions}>
        <Button title={t('common.cancel')} onPress={onDone} />
        <Button title={t('item.saveChanges')} variant="primary" busy={update.isPending} disabled={!title.trim() || !date || !start || !end || !!reminderIssue} onPress={save} />
      </View>
    </View>
  )
}
