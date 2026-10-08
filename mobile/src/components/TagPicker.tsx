import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { addTypedTags, hasTag, tagChoices, toggleTag } from '@shared/tags'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useColors } from '@/theme'

/**
 * An item's tags: every tag the user has used is a chip to tap on or off
 * (several at once), and a box adds a new one - kept in the list for next
 * time once the item is saved. Same as the web's TagPicker.
 */
export function TagPicker({ value, onChange, changed }: { value: string[]; onChange: (tags: string[]) => void; changed?: boolean }) {
  const c = useColors()
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const known = tags.data?.map((x) => x.name) ?? []
  const [typed, setTyped] = useState('')
  const add = () => {
    if (!typed.trim()) return
    onChange(addTypedTags(value, typed, known))
    setTyped('')
  }

  return (
    <View style={[{ gap: 6 }, changed && { borderWidth: 2, borderColor: c.accent, borderRadius: 12, padding: 4 }]}>
      <Text style={{ color: changed ? c.accent : c.muted, fontSize: 13 }}>{t('task.tags')}</Text>
      <View style={styles.wrap} accessibilityLabel={t('task.tags')}>
        {tagChoices(known, value).map((name) => {
          const on = hasTag(value, name)
          return (
            <Pressable
              key={name}
              onPress={() => onChange(toggleTag(value, name))}
              style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : 'transparent' }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontSize: 14 }}>#{name}</Text>
            </Pressable>
          )
        })}
        <View style={[styles.chip, styles.newTag, { borderColor: c.border, borderStyle: 'dashed' }]}>
          <TextInput
            value={typed}
            onChangeText={(text) => {
              // A comma ends a tag, like Enter.
              if (text.endsWith(',')) {
                onChange(addTypedTags(value, text, known))
                setTyped('')
              } else setTyped(text)
            }}
            onSubmitEditing={add}
            onBlur={add}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder={t('tags.new')}
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            maxLength={120}
            style={[styles.input, { color: c.text }]}
            accessibilityLabel={t('tags.new')}
          />
          <Pressable onPress={add} disabled={!typed.trim()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('tags.add')}>
            <Ionicons name="add" size={20} color={typed.trim() ? c.accent : c.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
  newTag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 6 },
  input: { minWidth: 90, paddingVertical: 4, fontSize: 14 },
})
