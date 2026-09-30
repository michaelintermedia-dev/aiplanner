import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { QuickAddTask } from '@/components/QuickAddTask'
import { Screen } from '@/components/Screen'
import { TaskRow } from '@/components/TaskRow'
import { Section } from '@/components/ui'
import { useColors } from '@/theme'

export default function TasksScreen() {
  const c = useColors()
  const [showDone, setShowDone] = useState(false)
  const { data, isPending, error } = useQuery({
    queryKey: ['tasks', { showDone }],
    queryFn: () => tasksApi.list(showDone),
  })

  return (
    <Screen>
      <QuickAddTask />
      <View style={[styles.segmented, { borderColor: c.border }]}>
        {[false, true].map((all) => (
          <Pressable
            key={String(all)}
            onPress={() => setShowDone(all)}
            style={[styles.segment, showDone === all && { backgroundColor: c.accentSoft }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: showDone === all }}>
            <Text style={{ color: showDone === all ? c.accent : c.text, fontWeight: showDone === all ? '600' : '400' }}>
              {all ? 'All' : 'Active'}
            </Text>
          </Pressable>
        ))}
      </View>
      {isPending && <Text style={{ color: c.muted }}>Loading…</Text>}
      {error && <Text style={{ color: c.danger }}>{error.message}</Text>}
      {data && (
        <Section title={showDone ? 'All tasks' : 'Active tasks'} empty="No tasks yet. Add one above.">
          {data.map((t, i) => (
            <TaskRow key={t.id} task={t} last={i === data.length - 1} />
          ))}
        </Section>
      )}
      <Text style={[styles.hint, { color: c.muted }]}>Tip: long-press a task to cancel or delete it.</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
})
