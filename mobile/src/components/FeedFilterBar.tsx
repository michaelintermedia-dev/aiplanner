import Ionicons from '@expo/vector-icons/Ionicons'
import {
  CREATED_OPTIONS,
  filterChips,
  filterTagsShown,
  HAS_OPTIONS,
  NO_FILTERS,
  ORIGIN_OPTIONS,
  REMINDER_OPTIONS,
  STATUS_OPTIONS,
  WHEN_OPTIONS,
  type FeedFilters,
} from '@shared/feedFilter'
import { QUICK_VIEWS, toggleView, viewLabel, type QuickView, type QuickViewId } from '@shared/feedViews'
import { useQuery } from '@tanstack/react-query'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { Button } from './ui'
import { t } from '@shared/i18n'

type IconName = ComponentProps<typeof Ionicons>['name']

/** Same icons as the web's quick views. */
const VIEW_ICON: Record<QuickViewId, IconName> = {
  today: 'today-outline',
  upcoming: 'calendar-outline',
  overdue: 'alert-circle-outline',
  openTasks: 'square-outline',
  done: 'checkmark-done-outline',
  photos: 'image-outline',
  voice: 'mic-outline',
  changed: 'create-outline',
}

/**
 * Above the feed (same as the web app): the search box, the quick views (one
 * tap = a common question with its own order), the Filter button + panel and
 * the active filters as removable chips. They apply to whichever tab is
 * showing and stay across tabs.
 */
export function FeedFilterBar({
  filters,
  onChange,
  onView,
  sortChip,
  selectChip,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  /** A quick view was tapped (the screen may switch tabs for it). */
  onView: (view: QuickView, next: FeedFilters) => void
  sortChip?: ReactNode
  selectChip?: ReactNode
}) {
  const c = useColors()
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  // The search box shows the text; a quick view's chip shows what it set.
  const chips = filterChips(filters, zone.locale).filter((chip) => chip.key !== 'text')
  const shownChips = filters.view ? [] : chips

  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.search, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Ionicons name="search" size={16} color={c.muted} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          value={filters.text}
          onChangeText={(text) => onChange({ ...filters, text })}
          placeholder={t('filter.searchPlaceholder')}
          placeholderTextColor={c.muted}
          returnKeyType="search"
          accessibilityLabel={t('filter.search')}
        />
        {!!filters.text && (
          <Pressable onPress={() => onChange({ ...filters, text: '' })} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('filter.searchClear')}>
            <Ionicons name="close-circle" size={18} color={c.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.views} accessibilityLabel={t('view.label')}>
        {QUICK_VIEWS.map((v) => {
          const on = filters.view === v.id
          return (
            <Pressable
              key={v.id}
              onPress={() => onView(v, toggleView(filters, v))}
              style={[styles.toggle, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}>
              <Ionicons name={VIEW_ICON[v.id]} size={15} color={on ? c.accentText : c.text} />
              <Text style={{ color: on ? c.accentText : c.text }}>{viewLabel(v)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

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

      {shownChips.length > 0 && (
        <View style={styles.wrap}>
          {shownChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => onChange(chip.clear(filters))}
              style={[styles.activeChip, { borderColor: c.accent, backgroundColor: c.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('filter.remove', { label: chip.label })}>
              <Text style={{ color: c.text, fontSize: 13 }}>{chip.label}</Text>
              <Ionicons name="close" size={14} color={c.muted} />
            </Pressable>
          ))}
          <Button title={t('filter.clearAll')} variant="link" onPress={() => onChange({ ...NO_FILTERS, text: filters.text })} />
        </View>
      )}
    </View>
  )
}

/** Grouped like the web: What it is / has, When, Status, Where it came from. */
function FilterPanel({ filters: f, onChange, onClose }: { filters: FeedFilters; onChange: (f: FeedFilters) => void; onClose: () => void }) {
  const c = useColors()
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  // A change by hand ends the quick view (and its own order).
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch, view: null, sort: null })
  const [allTags, setAllTags] = useState(false)
  const usedCount = tags.data?.filter((tag) => tag.count > 0 || f.tags.includes(tag.name)).length ?? 0
  const usedTags = filterTagsShown(tags.data ?? [], f.tags, allTags)

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Group title={t('filter.group.what')}>
        <View style={styles.wrap}>
          {HAS_OPTIONS.map((o) => {
            const on = f.has.includes(o.value)
            return <OptionChip key={o.value} label={o.label} selected={on} onPress={() => set({ has: on ? f.has.filter((x) => x !== o.value) : [...f.has, o.value] })} />
          })}
        </View>
        {usedTags.length > 0 && (
          <View style={styles.wrap} accessibilityLabel={t('filter.tags')}>
            {usedTags.map((tag) => {
              const on = f.tags.includes(tag.name)
              return (
                <OptionChip
                  key={tag.name}
                  label={`#${tag.name} ${tag.count}`}
                  selected={on}
                  onPress={() => set({ tags: on ? f.tags.filter((x) => x !== tag.name) : [...f.tags, tag.name] })}
                />
              )
            })}
            {(usedCount > usedTags.length || allTags) && (
              <Button title={allTags ? t('tags.fewer') : t('tags.all', { count: usedCount })} variant="link" onPress={() => setAllTags((a) => !a)} />
            )}
          </View>
        )}
      </Group>

      <Group title={t('filter.group.when')}>
        <Options label={t('filter.when')} options={WHEN_OPTIONS} value={f.when} onChange={(when) => set({ when })} />
      </Group>

      <Group title={t('filter.group.status')}>
        <Options label={t('filter.status')} options={STATUS_OPTIONS} value={f.status} onChange={(status) => set({ status })} />
        <Options caption label={t('filter.reminders')} options={REMINDER_OPTIONS} value={f.reminders} onChange={(reminders) => set({ reminders })} />
      </Group>

      <Group title={t('filter.group.origin')}>
        <Options label={t('filter.group.origin')} options={ORIGIN_OPTIONS} value={f.origin} onChange={(origin) => set({ origin })} />
        <Options caption label={t('filter.created')} options={CREATED_OPTIONS} value={f.created} onChange={(created) => set({ created })} />
        {f.created === 'custom' && (
          <View style={styles.wrap}>
            <DateTimeField mode="date" value={f.createdFrom} onChange={(createdFrom) => set({ createdFrom })} placeholder={t('filter.from')} />
            <DateTimeField mode="date" value={f.createdTo} onChange={(createdTo) => set({ createdTo })} placeholder={t('filter.to')} />
          </View>
        )}
      </Group>

      <View style={{ alignItems: 'flex-end' }}>
        <Button title={t('common.done')} variant="primary" onPress={onClose} />
      </View>
    </View>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors()
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.caption, { color: c.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  )
}

function Options<T extends string>({
  label,
  caption,
  options,
  value,
  onChange,
}: {
  label: string
  caption?: boolean
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const c = useColors()
  return (
    <View style={{ gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {caption && <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>}
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
  views: { gap: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 30 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
})
