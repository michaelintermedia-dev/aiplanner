import Ionicons from '@expo/vector-icons/Ionicons'
import {
  clearSheetFilters,
  CREATED_OPTIONS,
  filterChips,
  filterTagsShown,
  HAS_OPTIONS,
  ORIGIN_OPTIONS,
  REMINDER_OPTIONS,
  sheetFilterCount,
  SHOW_OPTIONS,
  STATUS_OPTIONS,
  TOGGLES,
  WHEN_OPTIONS,
  type FeedFilters,
} from '@shared/feedFilter'
import { DEFAULT_ORDER, ORDER_OPTIONS, type OrderSetting } from '@shared/feedOrder'
import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { SearchMic } from './SearchMic'
import { Button } from './ui'

/**
 * Above the feed (spec v2, same as the web): the search box with its mic, ONE
 * row of chips - the type (All / Tasks / Events / Notes, one at a time), the
 * toggles Open / Today / With media, and ⚙ (the sheet with every other filter
 * and the order; its badge counts what it set) - then those extra filters as
 * removable chips.
 */
export function FeedChipBar({
  filters,
  onChange,
  order,
  onOrder,
  onSelect,
  canSelect,
}: {
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  order: OrderSetting
  onOrder: (o: OrderSetting) => void
  /** "Select items" in the sheet (delete several). */
  onSelect: () => void
  canSelect: boolean
}) {
  const c = useColors()
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const chips = filterChips(filters, zone.locale)
  const extra = sheetFilterCount(filters) + (order.order !== 'Smart' || order.priorityFirst ? 1 : 0)

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
        <SearchMic
          onText={(text) => {
            setMicError(null)
            onChange({ ...filters, text })
          }}
          onError={setMicError}
        />
      </View>
      {micError && <Text style={[{ color: c.danger }, c.pillStart]}>{micError}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.bar} accessibilityLabel={t('feed.show')}>
        {SHOW_OPTIONS.map((o) => {
          const on = filters.show === o.value
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange({ ...filters, show: o.value })}
              style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? c.accentText : c.text }}>{o.label}</Text>
            </Pressable>
          )
        })}
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        {TOGGLES.map((x) => {
          const on = x.on(filters)
          return (
            <Pressable
              key={x.id}
              onPress={() => onChange(x.flip(filters))}
              style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontWeight: on ? '600' : '400' }}>{x.label}</Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.chip, styles.sheetChip, { borderColor: extra ? c.accent : c.border, backgroundColor: c.surface }]}
          accessibilityRole="button"
          accessibilityLabel={extra ? `${t('filter.sheet')} · ${extra}` : t('filter.sheet')}>
          <Ionicons name="options-outline" size={18} color={extra ? c.accent : c.text} />
          {extra > 0 && (
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.accentText, fontSize: 11, fontWeight: '700' }}>{extra}</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>

      {chips.length > 0 && (
        <View style={styles.wrap}>
          {chips.map((chip) => (
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
          <Button title={t('filter.clearAll')} variant="link" onPress={() => onChange(clearSheetFilters(filters))} />
        </View>
      )}

      <FiltersSheet
        visible={open}
        filters={filters}
        onChange={onChange}
        order={order}
        onOrder={onOrder}
        onClose={() => setOpen(false)}
        onSelect={
          canSelect
            ? () => {
                setOpen(false)
                onSelect()
              }
            : undefined
        }
      />
    </View>
  )
}

/** The ⚙ sheet from the bottom: the order, then what the item has, when, status, how it was made. */
function FiltersSheet({
  visible,
  filters: f,
  onChange,
  order,
  onOrder,
  onClose,
  onSelect,
}: {
  visible: boolean
  filters: FeedFilters
  onChange: (f: FeedFilters) => void
  order: OrderSetting
  onOrder: (o: OrderSetting) => void
  onClose: () => void
  onSelect?: () => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags, enabled: visible })
  const set = (patch: Partial<FeedFilters>) => onChange({ ...f, ...patch })
  const [allTags, setAllTags] = useState(false)
  const usedCount = tags.data?.filter((tag) => tag.count > 0 || f.tags.includes(tag.name)).length ?? 0
  const usedTags = filterTagsShown(tags.data ?? [], f.tags, allTags)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: 16 + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.sheetHead}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{t('filter.sheet')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Group title={t('feed.order')}>
              <Options label={t('feed.order')} options={ORDER_OPTIONS} value={order.order} onChange={(value) => onOrder({ ...order, order: value })} />
              <View style={styles.wrap}>
                <OptionChip label={t('feed.sort.priority')} selected={order.priorityFirst} onPress={() => onOrder({ ...order, priorityFirst: !order.priorityFirst })} />
              </View>
            </Group>

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
          </ScrollView>
          <View style={styles.actions}>
            {onSelect && <Button title={t('select.start')} onPress={onSelect} />}
            <Button title={t('filter.clearAll')} variant="link" onPress={() => (onChange(clearSheetFilters(f)), onOrder(DEFAULT_ORDER))} />
            <Button title={t('common.done')} variant="primary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
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
      style={[styles.option, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent' }]}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={radio ? { selected } : { checked: selected }}>
      <Text style={{ color: selected ? c.accent : c.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
  sheetChip: { paddingHorizontal: 12 },
  divider: { width: 1, height: 22, marginHorizontal: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 30 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  option: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
})
