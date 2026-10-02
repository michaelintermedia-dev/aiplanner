import Ionicons from '@expo/vector-icons/Ionicons'
import { ITEM_TYPES, KIND_LABEL } from '@shared/feed'
import { t, type MessageKey } from '@shared/i18n'
import type { ItemType } from '@shared/types'
import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { itemsApi } from '@/api/endpoints'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { KIND_ICON } from './kindIcons'

/** What a change of type loses, said before doing it. */
const LOSES: Partial<Record<`${ItemType}>${ItemType}`, MessageKey>> = {
  'Task>Note': 'changeType.loses.taskToNote',
  'Task>Appointment': 'changeType.loses.taskToEvent',
  'Appointment>Note': 'changeType.loses.eventToNote',
}

const PATH = { Task: '/task/[id]', Appointment: '/appointment/[id]', Note: '/note/[id]' } as const

/** "Change it to a task?" */
const CONFIRM: Record<ItemType, MessageKey> = { Task: 'changeType.toTask', Appointment: 'changeType.toEvent', Note: 'changeType.toNote' }

/**
 * "Change type": any item can become a task, an event or a note (same on the
 * web). The old item is replaced by the new one; if something had to be
 * guessed (an event's time), the new item opens for editing.
 */
export function ChangeType({ itemType, id }: { itemType: ItemType; id: string }) {
  const c = useColors()
  const convert = useAction(itemsApi.convert, { forget: ({ fromType, id: oldId }) => [fromType.toLowerCase(), oldId] })

  const changeTo = (toType: ItemType) => {
    const warning = LOSES[`${itemType}>${toType}`]
    Alert.alert(t(CONFIRM[toType]), warning && t(warning), [
      { text: t('changeType.keep'), style: 'cancel' },
      {
        text: t('changeType.change'),
        onPress: () =>
          convert.mutate(
            { fromType: itemType, id, toType },
            {
              onSuccess: (item) =>
                router.replace({ pathname: PATH[item.itemType], params: { id: item.id, ...(item.needsDetails ? { edit: '1' } : {}) } }),
            },
          ),
      },
    ])
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('changeType.aria')}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('changeType.label')}</Text>
        {ITEM_TYPES.map((type) => {
          const on = type === itemType
          return (
            <Pressable
              key={type}
              onPress={() => !on && changeTo(type)}
              disabled={convert.isPending}
              style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : 'transparent' }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: convert.isPending }}
              accessibilityLabel={KIND_LABEL[type]}>
              <Ionicons name={KIND_ICON[type]} size={15} color={on ? c.accent : c.text} />
              <Text style={{ color: on ? c.accent : c.text, fontSize: 14 }}>{KIND_LABEL[type]}</Text>
            </Pressable>
          )
        })}
      </View>
      {convert.error && <Text style={{ color: c.danger }}>{convert.error.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
})
