import { zonedToUtc } from '@shared/dates'
import type { TaskPriority } from '@shared/types'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { Button } from './ui'

const PRIORITIES: TaskPriority[] = ['None', 'Low', 'Medium', 'High']

/**
 * Fast task entry: type a title and press Add; date, time and priority are
 * optional. Natural-language/voice capture replaces this with AI extraction in
 * Phase 3.
 */
export function QuickAddTask() {
  const c = useColors()
  const { zone } = useAuth()
  const create = useAction(tasksApi.create)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [priority, setPriority] = useState<TaskPriority>('None')
  const [ongoing, setOngoing] = useState(false)

  const submit = () => {
    if (!title.trim()) return
    // A date without a time is sent as the start of that day in the user's timezone.
    const dueDateUtc = !ongoing && date ? zonedToUtc(date, time, zone.timeZone) : null
    create.mutate(
      { title: title.trim(), dueDateUtc, hasDueTime: !!dueDateUtc && !!time, priority, isOngoing: ongoing },
      {
        onSuccess: () => {
          setTitle('')
          setDate(null)
          setTime(null)
          setPriority('None')
          setOngoing(false)
        },
      },
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <TextInput
        style={[styles.title, { color: c.text }]}
        placeholder="Add a task…"
        placeholderTextColor={c.muted}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        returnKeyType="done"
        accessibilityLabel="Task title"
      />
      <View style={styles.options}>
        <DateTimeField mode="date" value={date} onChange={setDate} placeholder="Date" disabled={ongoing} />
        <DateTimeField
          mode="time"
          value={time}
          onChange={setTime}
          placeholder="Time"
          date={date}
          disabled={ongoing || !date}
        />
        <Pressable
          onPress={() => setPriority(PRIORITIES[(PRIORITIES.indexOf(priority) + 1) % PRIORITIES.length])}
          style={[styles.chip, { borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Priority: ${priority}. Tap to change.`}>
          <Text style={{ color: priority === 'None' ? c.muted : priority === 'High' ? c.danger : c.text }}>
            {priority === 'None' ? 'Priority' : priority}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setOngoing(!ongoing)}
          style={[styles.chip, { borderColor: ongoing ? c.accent : c.border, backgroundColor: ongoing ? c.accentSoft : undefined }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: ongoing }}>
          <Text style={{ color: ongoing ? c.accent : c.muted }}>Ongoing</Text>
        </Pressable>
      </View>
      {create.error && <Text style={{ color: c.danger }}>{create.error.message}</Text>}
      <Button title="Add task" variant="primary" onPress={submit} disabled={!title.trim()} busy={create.isPending} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 12 },
  title: { fontSize: 17, paddingVertical: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
})
