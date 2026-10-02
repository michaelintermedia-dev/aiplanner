import Ionicons from '@expo/vector-icons/Ionicons'
import {
  CREATED_OPTIONS,
  filterChips,
  NO_FILTERS,
  REMINDER_OPTIONS,
  STATUS_OPTIONS,
  WHEN_OPTIONS,
  type FeedFilters,
} from '@shared/feedFilter'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { Button } from './ui'
import { t } from '@shared/i18n'

/**
 * Filter button + panel + active-filter chips above the feed (same as the web
 * app). The filters apply to whichever tab is showing and stay across tabs.
 */
export function FeedFilterBar({
  filters,
  onChange,
  sortChip,
  selectChip,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  sortChip: ReactNode
  selectChip?: ReactNode
}) {
  const c = useColors()
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const chips = filterChips(filters, zone.locale)

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.tools}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          style={[styles.toggle, { borderColor: chips.length ? c.accent : c.border, backgroundColor: c.surface }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={chips.length ? t('filter.buttonOn', { count: chips.length }) : t('filter.button')}>
          <Ionicons name="funnel-outline" size={16} color={chips.length ? c.accent : c.text} />
          <Text style={{ color: chips.length ? c.accent : c.text }}>{t('filter.button')}{chips.length ? ` · ${chips.length}` : ''}</Text>
        </Pressable>
        {selectChip}
        {sortChip}
      </View>

      {open && <FilterPanel filters={filters} onChange={onChange} onClose={() => setOpen(false)} />}

      {chips.length > 0 && (
        <View style={styles.wrap}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => onChange(chip.clear(filters))}
              style={[styles.activeChip, { borderColor: c.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('filter.remove', { label: chip.label })}>
              <Text style={{ color: c.text, fontSize: 13 }}>{chip.label}</Text>
              <Ionicons name="close" size={14} color={c.muted} />
            </Pressable>
          ))}
          <Button title={t('filter.clearAll')} variant="link" onPress={() => onChange(NO_FILTERS)} />
        </View>
      )}
    </View>
  )
}

function FilterPanel({ filters: f, onChange, onClose }: { filters: FeedFilters; onChange: (f: FeedFilters) => void; onClose: () => void }) {
  const c = useColors()
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch })

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.search, { borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.muted} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          value={f.text}
          onChangeText={(text) => set({ text })}
          placeholder={t('filter.searchPlaceholder')}
          placeholderTextColor={c.muted}
          autoFocus
          returnKeyType="search"
          accessibilityLabel={t('filter.search')}
        />
      </View>

      <Options label={t('filter.created').toUpperCase()} options={CREATED_OPTIONS} value={f.created} onChange={(created) => set({ created })} />
      {f.created === 'custom' && (
        <View style={styles.wrap}>
          <DateTimeField mode="date" value={f.createdFrom} onChange={(createdFrom) => set({ createdFrom })} placeholder={t('filter.from')} />
          <DateTimeField mode="date" value={f.createdTo} onChange={(createdTo) => set({ createdTo })} placeholder={t('filter.to')} />
        </View>
      )}
      <Options label={t('filter.when').toUpperCase()} options={WHEN_OPTIONS} value={f.when} onChange={(when) => set({ when })} />
      <Options label={t('filter.status').toUpperCase()} options={STATUS_OPTIONS} value={f.status} onChange={(status) => set({ status })} />
      <Options label={t('filter.reminders').toUpperCase()} options={REMINDER_OPTIONS} value={f.reminders} onChange={(reminders) => set({ reminders })} />

      <View style={{ gap: 6 }}>
        <Text style={[styles.caption, { color: c.muted }]}>{t('filter.more').toUpperCase()}</Text>
        <View style={styles.wrap}>
          <OptionChip label={t('filter.fromVoice')} selected={f.fromVoice} onPress={() => set({ fromVoice: !f.fromVoice })} />
        </View>
      </View>

      {tags.data && tags.data.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={[styles.caption, { color: c.muted }]}>{t('filter.tags').toUpperCase()}</Text>
          <View style={styles.wrap}>
            {tags.data.map((t) => {
              const on = f.tags.includes(t.name)
              return (
                <OptionChip
                  key={t.name}
                  label={`#${t.name} ${t.count}`}
                  selected={on}
                  onPress={() => set({ tags: on ? f.tags.filter((x) => x !== t.name) : [...f.tags, t.name] })}
                />
              )
            })}
          </View>
        </View>
      )}

      <View style={{ alignItems: 'flex-end' }}>
        <Button title={t('common.done')} variant="primary" onPress={onClose} />
      </View>
    </View>
  )
}

function Options<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors()
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[styles.caption, { color: c.muted }]}>{label}</Text>
      <View style={styles.wrap}>
        {options.map((o) => (
          <OptionChip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} radio />
        ))}
      </View>
    </View>
  )
}

function OptionChip({ label, selected, onPress, radio }: { label: string; selected: boolean; onPress: () => void; radio?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent' }]}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={radio ? { selected } : { checked: selected }}>
      <Text style={{ color: selected ? c.accent : c.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tools: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 30 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  searchInput: { flex: 1, minHeight: 42, fontSize: 15 },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
})
