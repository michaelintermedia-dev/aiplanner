import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { SORT_CRITERIA, sortLabel, sortShortLabel, type SortChip } from '@shared/sortCriteria'
import type { FeedSort } from '@shared/types'
import { useState, type ComponentProps } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { useColors } from '@/theme'
import { Button } from './ui'

type IconName = ComponentProps<typeof Ionicons>['name']

/** The ring around a chip that is on. */
const ON_RING = '#2f9e44'

/** One icon per criterion (same as web). */
const SORT_ICON: Record<FeedSort, IconName> = {
  PriorityHigh: 'flag',
  CreatedDesc: 'sparkles-outline',
  CreatedAsc: 'hourglass-outline',
  UpdatedDesc: 'create-outline',
  DateAsc: 'calendar-outline',
}

/**
 * The feed's sort criteria as round chips, one icon each (same as web). A tap
 * switches one off (pale tint, grey ring) or on again (green ring) and the
 * feed re-sorts. The ⇅ chip opens the editor: which criteria to show.
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
            <View style={[styles.ring, { borderColor: chip.on ? ON_RING : c.border, borderStyle: chip.on ? 'solid' : 'dashed' }]}>
              <View style={[styles.circle, { backgroundColor: chip.on ? c.accent : c.accentSoft }]}>
                <Ionicons name={SORT_ICON[chip.sort]} size={19} color={chip.on ? '#fff' : c.accent} />
              </View>
            </View>
            <Text style={[styles.label, { color: chip.on ? c.text : c.muted }, c.pill]} numberOfLines={1}>
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
          <Text style={[styles.label, { color: c.text }, c.pill]} numberOfLines={1}>
            {t('feed.sortBy')}
          </Text>
        </Pressable>
      </View>
      {chips.every((chip) => !chip.on) && <Text style={{ color: c.muted, fontSize: 13, textAlign: 'right' }}>{t('sort.allOff')}</Text>}
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

/** Pick the criteria; nothing changes until Save. */
function SortEditor({ chips, onSave, onCancel }: { chips: SortChip[]; onSave: (chips: SortChip[]) => void; onCancel: () => void }) {
  const c = useColors()
  const [draft, setDraft] = useState(() =>
    SORT_CRITERIA.map((k) => {
      const saved = chips.find((x) => x.sort === k.sort)
      return { sort: k.sort, picked: !!saved, on: saved?.on ?? true }
    }),
  )
  const set = (sort: FeedSort, patch: Partial<(typeof draft)[number]>) => setDraft((d) => d.map((x) => (x.sort === sort ? { ...x, ...patch } : x)))
  const picked = draft.filter((d) => d.picked)

  return (
    <View style={[styles.editor, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{t('sort.edit')}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('sort.editHint')}</Text>
      {draft.map((d) => (
        <View key={d.sort} style={styles.pickRow}>
          <View style={[styles.smallCircle, { backgroundColor: c.accent }]}>
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
      ))}
      {picked.length === 0 && <Text style={{ color: c.danger }}>{t('sort.pickOne')}</Text>}
      <View style={styles.actions}>
        <Button title={t('common.cancel')} onPress={onCancel} />
        <Button
          title={t('common.save')}
          variant="primary"
          disabled={picked.length === 0}
          onPress={() => onSave(picked.map(({ sort, on }) => ({ sort, on })))}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Under the Select button, on the end side (right; left in Hebrew).
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  chip: { width: 64, alignItems: 'center', gap: 4 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11 },
  editor: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
