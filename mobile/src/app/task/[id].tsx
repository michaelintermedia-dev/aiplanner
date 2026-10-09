import { describeRecurrence } from '@shared/recurrence'
import { dateKey, formatDateKey, formatDue, formatTime } from '@shared/dates'
import { formFromTask } from '@shared/itemForm'
import { describeReminder } from '@shared/reminders'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { detailStyles as s, Facts, TextBlock } from '@/components/detail'
import { DraftNotice, EditButtons, FollowUpReview, useEditMode } from '@/components/ItemEditMode'
import { hasEditDraft, ItemEditor } from '@/components/ItemEditor'
import { Screen } from '@/components/Screen'
import { ItemMedia } from '@/components/ItemMedia'
import { SourceCapture } from '@/components/SourceCapture'
import { Badge, Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useColors()
  const { zone } = useAuth()
  // Everything that changes the task happens in Edit (`edit=1` / `talk=1` open it; so does the floating mic).
  const edit = useEditMode()
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: task, isPending, error } = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id), enabled: !deleting })

  const complete = useAction(tasksApi.complete)
  const cancel = useAction(tasksApi.cancel)
  const reopen = useAction(tasksApi.reopen)
  const remove = useAction(tasksApi.remove)
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <Screen><Text style={{ color: c.muted }}>{t('common.loading')}</Text></Screen>
  if (error || !task) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? t('task.notFound')}</Text></Screen>

  const closed = task.status === 'Completed' || task.status === 'Cancelled'

  const confirmDelete = () =>
    Alert.alert(t('task.confirmDelete'), task.title, [
      { text: t('changeType.keep'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(task.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: edit.editing ? t('common.edit') : t('kind.task') }} />
      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      <DraftNotice show={!edit.editing && hasEditDraft(task.id, formFromTask(task, zone.timeZone))} onContinue={edit.edit} />
      {edit.editing ? (
        <ItemEditor
          item={{ itemType: 'Task', id: task.id, title: task.title }}
          saved={formFromTask(task, zone.timeZone)}
          captureId={task.sourceCaptureId ?? null}
          talkSignal={edit.talkSignal}
          onDone={edit.done}
        />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.task }]}>{t('kind.task').toUpperCase()}</Text>
            <Text style={[s.title, { color: closed ? c.muted : c.text }, closed && s.struck]}>{task.title}</Text>
            <View style={s.badges}>
              <Badge
                label={statusLabel(task.status)}
                color={task.status === 'Completed' ? c.task : task.status === 'Cancelled' ? c.danger : undefined}
              />
              {task.priority !== 'None' && (
                <Badge label={t('task.priorityBadge', { priority: priorityLabel(task.priority) })} color={task.priority === 'High' ? c.danger : task.priority === 'Medium' ? c.warn : undefined} />
              )}
              {task.tags.map((tag) => (
                <Text key={tag} style={{ color: c.muted }}>#{tag}</Text>
              ))}
            </View>
          </View>

          <Facts
            rows={[
              [t('task.due'), task.dueDateUtc ? formatDue(task.dueDateUtc, task.hasDueTime, zone) : task.status === 'Ongoing' ? t('task.ongoingNoDeadline') : t('task.noDueDate')],
              ...(task.location ? [[t('event.where'), task.location] as [string, string]] : []),
              ...(task.people?.length ? [[t('event.with'), task.people.join(', ')] as [string, string]] : []),
              [t('filter.reminders'), task.reminders?.length ? task.reminders.map((r) => describeReminder(r, zone)).join(' · ') : t('item.none')],
              ...(task.recurrence ? [[t('repeat.repeats'), describeRecurrence(task.recurrence, zone)] as [string, string]] : []),
              // A repeating task stays open: this is when it was last done.
              ...(task.completedAtUtc
                ? [[task.recurrence && task.status !== 'Completed' ? t('repeat.lastDone') : t('status.Completed'), formatDue(task.completedAtUtc, true, zone)] as [string, string]]
                : []),
              [t('filter.created'), `${formatDateKey(dateKey(task.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(task.createdAtUtc, zone)}`],
            ]}
          />

          <TextBlock title={t('item.description')} text={task.description} />
          <TextBlock title={t('item.notes')} text={task.notes} />
          <TextBlock title={t('item.aiSummary')} text={task.aiSummary} />

          {actionError && <Text style={{ color: c.danger }}>{actionError.message}</Text>}
          <View style={s.actions}>
            {closed ? (
              <Button title={`↺ ${t('item.reopen')}`} variant="primary" busy={reopen.isPending} disabled={busy} onPress={() => reopen.mutate(task.id)} />
            ) : (
              <>
                <Button title={`✓ ${t('task.complete')}`} variant="primary" busy={complete.isPending} disabled={busy} onPress={() => complete.mutate(task.id)} />
                <Button title={t('task.cancel')} disabled={busy} onPress={() => cancel.mutate(task.id)} />
              </>
            )}
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} disabled={busy} />
            <Button title={t('common.delete')} variant="danger" disabled={busy} onPress={confirmDelete} />
          </View>
        </>
      )}

      {!edit.editing && <ItemMedia itemType="Task" id={task.id} />}

      {!edit.editing && task.sourceCaptureId && <SourceCapture captureId={task.sourceCaptureId} />}
    </Screen>
  )
}
