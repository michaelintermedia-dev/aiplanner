import { Children, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native'
import { useColors } from '@/theme'

export function Section({ title, empty, tone, children }: { title: string; empty?: string; tone?: 'warn'; children?: ReactNode }) {
  const c = useColors()
  const count = Children.count(children)
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: tone === 'warn' ? c.danger : c.muted }]}>{title.toUpperCase()}</Text>
        {count > 0 && <Text style={[styles.count, { color: c.muted, backgroundColor: c.surface2 }]}>{count}</Text>}
      </View>
      {count > 0 ? (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
      ) : (
        empty && <Text style={[styles.empty, { color: c.muted }]}>{empty}</Text>
      )}
    </View>
  )
}

export function Badge({ label, color, background }: { label: string; color?: string; background?: string }) {
  const c = useColors()
  return (
    <Text style={[styles.badge, { color: color ?? c.muted, backgroundColor: background ?? c.surface2 }]}>{label}</Text>
  )
}

export function Button({
  title,
  variant = 'default',
  busy,
  ...props
}: PressableProps & { title: string; variant?: 'default' | 'primary' | 'link' | 'danger'; busy?: boolean }) {
  const c = useColors()
  const disabled = props.disabled || busy
  const containerStyle =
    variant === 'primary'
      ? { backgroundColor: c.accent, borderColor: c.accent }
      : variant === 'link' || variant === 'danger'
        ? { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 8 }
        : { backgroundColor: c.surface, borderColor: c.border }
  const textColor = variant === 'primary' ? c.accentText : variant === 'danger' ? c.danger : variant === 'link' ? c.muted : c.text
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      style={({ pressed }) => [styles.button, containerStyle, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  )
}

export function Row({ children, last }: { children: ReactNode; last?: boolean }) {
  const c = useColors()
  return <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>{children}</View>
}

export const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  count: { fontSize: 12, borderRadius: 999, paddingHorizontal: 7, overflow: 'hidden' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  empty: { fontSize: 14, paddingVertical: 4 },
  badge: { fontSize: 12, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
})
