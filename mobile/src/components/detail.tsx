import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useColors } from '@/theme'
import { useCardStyle } from './panel'

/** Building blocks shared by the task and appointment detail screens. */

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const c = useColors()
  const flat = useCardStyle()
  return (
    <View style={[styles.facts, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text style={[styles.factLabel, { color: c.muted }]}>{label}</Text>
          <Text style={[styles.factValue, { color: c.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

export function TextBlock({ title, text }: { title: string; text: string | null | undefined }) {
  const c = useColors()
  if (!text) return null
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.blockTitle, { color: c.muted }]}>{title.toUpperCase()}</Text>
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{text}</Text>
    </View>
  )
}

/** A labelled text field; `changed` marks one the AI just filled in from what was said. */
export function Field({ label, changed, ...props }: TextInputProps & { label: string; changed?: boolean }) {
  const c = useColors()
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: changed ? c.accent : c.muted, fontSize: 13 }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && styles.multiline,
          { color: c.text, borderColor: changed ? c.accent : c.border, backgroundColor: c.surface },
          changed && { borderWidth: 2 },
        ]}
      />
    </View>
  )
}

/** A chip that cycles through values on tap. */
export function CycleChip<T>({
  values,
  value,
  onChange,
  label,
  highlight,
}: {
  values: T[]
  value: T
  onChange: (v: T) => void
  label: (v: T) => string
  highlight?: (v: T) => boolean
}) {
  const c = useColors()
  const on = highlight ? highlight(value) : true
  return (
    <Pressable
      onPress={() => onChange(values[(values.indexOf(value) + 1) % values.length])}
      style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${label(value)}. Tap to change.`}>
      <Text style={{ color: on ? c.text : c.muted }}>{label(value)}</Text>
    </Pressable>
  )
}

export const detailStyles = StyleSheet.create({
  kind: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, paddingLeft: 8, borderLeftWidth: 3 },
  title: { fontSize: 26, fontWeight: '700' },
  struck: { textDecorationLine: 'line-through' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  form: { gap: 14 },
})

const styles = StyleSheet.create({
  facts: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  fact: { flexDirection: 'row', gap: 12 },
  factLabel: { width: 84, fontSize: 14 },
  factValue: { flex: 1, fontSize: 15 },
  blockTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
  multiline: { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
})
