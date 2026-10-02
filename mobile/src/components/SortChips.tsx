import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { SORT_COLORS, SORT_CRITERIA, SORT_ON_RING, sortLabel, sortShortLabel, withAlpha, type SortChip } from '@shared/sortCriteria'
import type { FeedSort } from '@shared/types'
import { useState, type ComponentProps } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { useColors } from '@/theme'
import { Button } from './ui'

type IconName = ComponentProps<typeof Ionicons>['name']

/** One icon per criterion (same as web). */
const SORT_ICON: Record<FeedSort, IconName> = {
  PriorityHigh: 'flag',
  CreatedDesc: 'sparkles-outline',
  CreatedAsc: 'hourglass-outline',
  UpdatedDesc: 'create-outline',
  DateAsc: 'calendar-outline',
}

/**
 * The feed's sort criteria as round coloured chips (same as web). A tap
 * switches one off (pale tint, grey ring) or on again (green ring) and the
 * feed re-sorts. The ⇅ chip opens the editor: which criteria, and colours.
 */
export function SortChips({ chips, onChange }: { chips: SortChip[]; onChange: (chips: SortChip[]) => void }) {
  const c = useColors()
  const [editing, setEditing] = useState(false)

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        {chips.map((chip) => (
          <Pressable
            key={chip.sort}
            onPress={() => onChange(chips.map((x) => (x.sort === chip.sort ? { ...x, on: !x.on } : x)))}
            style={styles.chip}
            accessibilityRole="switch"
            accessibilityState={{ checked: chip.on }}
            accessibilityLabel={t(chip.on ? 'sort.toggleOn' : 'sort.toggleOff', { label: sortLabel(chip.sort) })}>
            <View style={[styles.ring, { borderColor: chip.on ? SORT_ON_RING : c.border, borderStyle: chip.on ? 'solid' : 'dashed' }]}>
              <View style={[styles.circle, { backgroundColor: chip.on ? chip.color : withAlpha(chip.color, 0.22) }]}>
                <Ionicons name={SORT_ICON[chip.sort]} size={19} color={chip.on ? '#fff' : chip.color} />
              </View>
            </View>
            <Text style={[styles.label, { color: chip.on ? c.text : c.muted }]} numberOfLines={1}>
              {sortShortLabel(chip.sort)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setEditing((e) => !e)}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={t('sort.edit')}
          accessibilityState={{ expanded: editing }}>
          <View style={[styles.ring, { borderColor: 'transparent' }]}>
            <View style={[styles.circle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
              <Ionicons name="swap-vertical" size={19} color={c.text} />
            </View>
          </View>
          <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
            {t('feed.sortBy')}
          </Text>
        </Pressable>
      </View>
      {chips.every((chip) => !chip.on) && <Text style={{ color: c.muted, fontSize: 13 }}>{t('sort.allOff')}</Text>}
      {editing && (
        <SortEditor
          chips={chips}
          onSave={(next) => {
            onChange(next)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </View>
  )
}

/** Pick criteria and a colour for each; nothing changes until Save. */
function SortEditor({ chips, onSave, onCancel }: { chips: SortChip[]; onSave: (chips: SortChip[]) => void; onCancel: () => void }) {
  const c = useColors()
  const [draft, setDraft] = useState(() =>
    SORT_CRITERIA.map((k) => {
      const saved = chips.find((x) => x.sort === k.sort)
      return { sort: k.sort, color: saved?.color ?? k.color, picked: !!saved, on: saved?.on ?? true }
    }),
  )
  const set = (sort: FeedSort, patch: Partial<(typeof draft)[number]>) => setDraft((d) => d.map((x) => (x.sort === sort ? { ...x, ...patch } : x)))
  const picked = draft.filter((d) => d.picked)

  return (
    <View style={[styles.editor, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{t('sort.edit')}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('sort.editHint')}</Text>
      {draft.map((d) => (
        <View key={d.sort} style={{ gap: 8 }}>
          <View style={styles.pickRow}>
            <View style={[styles.smallCircle, { backgroundColor: d.color }]}>
              <Ionicons name={SORT_ICON[d.sort]} size={14} color="#fff" />
            </View>
            <Text style={{ flex: 1, color: c.text, fontSize: 15 }}>{sortLabel(d.sort)}</Text>
            <Switch
              value={d.picked}
              onValueChange={(on) => set(d.sort, { picked: on, on: true })}
              trackColor={{ true: c.accent }}
              accessibilityLabel={sortLabel(d.sort)}
            />
          </View>
          <View
            style={[styles.swatches, { opacity: d.picked ? 1 : 0.45 }]}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('sort.color', { label: sortLabel(d.sort) })}>
            {SORT_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => set(d.sort, { color, picked: true })}
                hitSlop={4}
                style={[styles.swatchRing, { borderColor: d.color === color ? c.text : 'transparent' }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.color === color }}
                accessibilityLabel={color}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {picked.length === 0 && <Text style={{ color: c.danger }}>{t('sort.pickOne')}</Text>}
      <View style={styles.actions}>
        <Button title={t('common.cancel')} onPress={onCancel} />
        <Button
          title={t('common.save')}
          variant="primary"
          disabled={picked.length === 0}
          onPress={() => onSave(picked.map(({ sort, color, on }) => ({ sort, color, on })))}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { width: 64, alignItems: 'center', gap: 4 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11 },
  editor: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingStart: 38 },
  swatchRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
