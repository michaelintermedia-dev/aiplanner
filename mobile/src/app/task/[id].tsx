import { dateKey, formatDateKey, formatDue, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import { describeReminder, remindersProblem } from '@shared/reminders'
import type { Reminder, Task, TaskPriority } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { DateTimeField } from '@/components/DateTimeField'
import { CycleChip, detailStyles as s, Facts, Field, TextBlock } from '@/components/detail'
import { ReminderList } from '@/components/ReminderList'
import { ChangeType } from '@/components/ChangeType'
import { Screen } from '@/components/Screen'
import { SourceCapture } from '@/components/SourceCapture'
import { Badge, Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'

const PRIORITIES: TaskPriority[] = ['None', 'Low', 'Medium', 'High']

export default function TaskDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>()
  const c = useColors()
  const { zone } = useAuth()
  // `edit=1`: just changed into a task and something needs checking.
  const [editing, setEditing] = useState(edit === '1')
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: task, isPending, error } = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id), enabled: !deleting })

  const complete = useAction(tasksApi.complete)
  const cancel = useAction(tasksApi.cancel)
  const reopen = useAction(tasksApi.reopen)
  const remove = useAction(tasksApi.remove)
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <Screen><Text style={{ color: c.muted }}>Loading…</Text></Screen>
  if (error || !task) return <Screen><Text style={{ color: c.danger }}>{error?.message ?? 'Task not found.'}</Text></Screen>

  const closed = task.status === 'Completed' || task.status === 'Cancelled'

  const confirmDelete = () =>
    Alert.alert('Delete task?', task.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          remove.mutate(task.id, { onSuccess: () => router.back(), onError: () => setDeleting(false) })
        },
      },
    ])

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Edit task' : 'Task' }} />
      {editing ? (
        <TaskEditForm task={task} onDone={() => setEditing(false)} />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[s.kind, { color: c.muted, borderLeftColor: c.task }]}>TASK</Text>
            <Text style={[s.title, { color: closed ? c.muted : c.text }, closed && s.struck]}>{task.title}</Text>
            <View style={s.badges}>
              <Badge
                label={task.status}
                color={task.status === 'Completed' ? c.task : task.status === 'Cancelled' ? c.danger : undefined}
              />
              {task.priority !== 'None' && (
                <Badge label={`${task.priority} priority`} color={task.priority === 'High' ? c.danger : task.priority === 'Medium' ? c.warn : undefined} />
              )}
              {task.tags.map((t) => (
                <Text key={t} style={{ color: c.muted }}>#{t}</Text>
              ))}
            </View>
          </View>
          <ChangeType itemType="Task" id={task.id} />

          <Facts
            rows={[
              ['Due', task.dueDateUtc ? formatDue(task.dueDateUtc, task.hasDueTime, zone) : task.status === 'Ongoing' ? 'Ongoing — no deadline' : 'No due date'],
              ['Reminders', task.reminders?.length ? task.reminders.map((r) => describeReminder(r, zone)).join(' · ') : 'None'],
              ...(task.completedAtUtc ? [['Completed', formatDue(task.completedAtUtc, true, zone)] as [string, string]] : []),
              ['Created', `${formatDateKey(dateKey(task.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric' })}, ${formatTime(task.createdAtUtc, zone)}`],
            ]}
          />

          <TextBlock title="Description" text={task.description} />
          <TextBlock title="Notes" text={task.notes} />
          <TextBlock title="AI summary" text={task.aiSummary} />

          {actionError && <Text style={{ color: c.danger }}>{actionError.message}</Text>}
          <View style={s.actions}>
            {closed ? (
              <Button title="↺ Reopen" variant="primary" busy={reopen.isPending} disabled={busy} onPress={() => reopen.mutate(task.id)} />
            ) : (
              <>
                <Button title="✓ Complete" variant="primary" busy={complete.isPending} disabled={busy} onPress={() => complete.mutate(task.id)} />
                <Button title="Cancel task" disabled={busy} onPress={() => cancel.mutate(task.id)} />
              </>
            )}
            <Button title="Edit" disabled={busy} onPress={() => setEditing(true)} />
            <Button title="Delete" variant="danger" disabled={busy} onPress={confirmDelete} />
          </View>
        </>
      )}

      {task.sourceCaptureId && <SourceCapture captureId={task.sourceCaptureId} item={{ itemType: 'Task', itemId: task.id, title: task.title }} />}
    </Screen>
  )
}

function TaskEditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const c = useColors()
  const { zone } = useAuth()
  const update = useAction((body: Parameters<typeof tasksApi.update>[1]) => tasksApi.update(task.id, body))
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [date, setDate] = useState<string | null>(task.dueDateUtc ? dateKey(task.dueDateUtc, zone.timeZone) : null)
  const [time, setTime] = useState<string | null>(task.dueDateUtc && task.hasDueTime ? timeKey(task.dueDateUtc, zone.timeZone) : null)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [ongoing, setOngoing] = useState(task.status === 'Ongoing')
  const [reminders, setReminders] = useState<Reminder[]>(task.reminders ?? [])
  const reminderIssue = remindersProblem(reminders, { itemHasTime: !ongoing && !!date && !!time, isNote: false })
  const [tags, setTags] = useState(task.tags.join(', '))

  const save = () => {
    const dueDateUtc = !ongoing && date ? zonedToUtc(date, time, zone.timeZone) : null
    update.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        dueDateUtc,
        hasDueTime: !!dueDateUtc && !!time,
        priority,
        isOngoing: ongoing,
        reminders,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <View style={s.form}>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <View style={s.chips}>
        <DateTimeField mode="date" value={date} onChange={setDate} placeholder="Due date" disabled={ongoing} />
        <DateTimeField mode="time" value={time} onChange={setTime} placeholder="Time" date={date} disabled={ongoing || !date} />
      </View>
      <View style={s.chips}>
        <CycleChip
          values={PRIORITIES}
          value={priority}
          onChange={setPriority}
          label={(p) => (p === 'None' ? 'No priority' : `${p} priority`)}
          highlight={(p) => p !== 'None'}
        />
        <CycleChip values={[false, true]} value={ongoing} onChange={setOngoing} label={(o) => (o ? 'Ongoing ✓' : 'Ongoing')} highlight={(o) => o} />
      </View>
      <ReminderList value={reminders} onChange={setReminders} itemHasTime={!ongoing && !!date && !!time} />
      <Field label="Tags (comma-separated)" value={tags} onChangeText={setTags} autoCapitalize="none" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {update.error && <Text style={{ color: c.danger }}>{update.error.message}</Text>}
      <View style={s.actions}>
        <Button title="Cancel" onPress={onDone} />
        <Button title="Save changes" variant="primary" busy={update.isPending} disabled={!title.trim() || !!reminderIssue} onPress={save} />
      </View>
    </View>
  )
}
