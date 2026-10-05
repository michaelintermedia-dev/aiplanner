import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import { formFromAppointment } from '@shared/itemForm'
import { describeReminder } from '@shared/reminders'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { appointmentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { detailStyles as s, Facts, TextBlock } from '@/components/detail'
import { DraftNotice, EditButtons, FollowUpReview, useEditMode } from '@/components/ItemEditMode'
import { hasEditDraft, ItemEditor } from '@/components/ItemEditor'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { Badge, Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'
import { statusLabel } from '@shared/labels'

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { zone } = useAuth()
  // Everything that changes the event happens in Edit (`edit=1` / `talk=1` open it; so does the floating mic).
  const edit = useEditMode()
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
      <Stack.Screen options={{ title: edit.editing ? t('common.edit') : t('kind.event') }} />
      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      <DraftNotice show={!edit.editing && hasEditDraft(appt.id, formFromAppointment(appt, zone.timeZone))} onContinue={edit.edit} />
      {edit.editing ? (
        <ItemEditor
          item={{ itemType: 'Appointment', id: appt.id, title: appt.title }}
          saved={formFromAppointment(appt, zone.timeZone)}
          captureId={appt.sourceCaptureId ?? null}
          talkSignal={edit.talkSignal}
          onDone={edit.done}
        />
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
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} disabled={busy} />
            <Button title={t('common.delete')} variant="danger" disabled={busy} onPress={confirmDelete} />
          </View>
        </>
      )}

      {!edit.editing && appt.sourceCaptureId && <SourceCapture captureId={appt.sourceCaptureId} item={{ itemType: 'Appointment', itemId: appt.id, title: appt.title }} />}
    </Screen>
  )
}
