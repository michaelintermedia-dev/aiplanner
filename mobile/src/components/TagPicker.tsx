import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { addTypedTags, newTagName, tagChoices, tagSuggestions, toggleTag } from '@shared/tags'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useColors } from '@/theme'

/**
 * An item's tags (redone at the user's request, 2026-10-12 - the old picker
 * showed every tag ever used): the item's tags as chips with an x, one "Add a
 * tag" box that suggests the most used tags, then - while typing - the
 * matching ones and "Create ..." for a new name; "All tags" opens the whole
 * list when wanted. Same as the web's TagPicker.
 */
export function TagPicker({ value, onChange, changed }: { value: string[]; onChange: (tags: string[]) => void; changed?: boolean }) {
  const c = useColors()
  const tags = useQuery({ queryKey: ['feed', 'tags'], queryFn: feedApi.tags })
  const known = tags.data?.map((x) => x.name) ?? []
  const [typed, setTyped] = useState('')
  const [all, setAll] = useState(false)
  const suggestions = tagSuggestions(known, value, typed)
  const create = newTagName(known, value, typed)
  const others = tagChoices(known, value).filter((n) => !value.includes(n))

  const add = (text = typed) => {
    if (!text.trim()) return
    onChange(addTypedTags(value, text, known))
    setTyped('')
  }

  const chip = (name: string, onPress: () => void, extra?: { icon?: 'add'; label?: string }) => (
    <Pressable
      key={extra?.label ?? name}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button">
      {extra?.icon && <Ionicons name="add" size={16} color={c.accent} />}
      <Text style={{ color: extra?.icon ? c.accent : c.text, fontSize: 14 }}>{extra?.label ?? `#${name}`}</Text>
    </Pressable>
  )

  return (
    <View style={[{ gap: 8 }, changed && { borderWidth: 2, borderColor: c.accent, borderRadius: 12, padding: 4 }]}>
      <Text style={{ color: changed ? c.accent : c.muted, fontSize: 13 }}>{t('task.tags')}</Text>
      {value.length > 0 && (
        <View style={styles.wrap} accessibilityLabel={t('task.tags')}>
          {value.map((name) => (
            <View key={name} style={[styles.chip, styles.on, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
              <Text style={{ color: c.accent, fontSize: 14 }}>#{name}</Text>
              <Pressable onPress={() => onChange(toggleTag(value, name))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('tags.remove', { name })}>
                <Ionicons name="close" size={16} color={c.accent} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
        <TextInput
          value={typed}
          onChangeText={(text) => {
            // A comma ends a tag, like Enter.
            if (text.endsWith(',')) add(text)
            else setTyped(text)
          }}
          onSubmitEditing={() => add()}
          onBlur={() => add()}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={t('tags.placeholder')}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          maxLength={120}
          style={[styles.input, { color: c.text }]}
          accessibilityLabel={t('tags.placeholder')}
        />
        <Pressable onPress={() => add()} disabled={!typed.trim()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('tags.add')}>
          <Ionicons name="add" size={22} color={typed.trim() ? c.accent : c.muted} />
        </Pressable>
      </View>
      {(suggestions.length > 0 || create) && (
        <View style={styles.wrap} accessibilityLabel={t('tags.suggestions')}>
          {suggestions.map((name) => chip(name, () => add(name)))}
          {create && chip(create, () => add(create), { icon: 'add', label: t('tags.create', { name: create }) })}
        </View>
      )}
      {!typed && others.length > suggestions.length && (
        <>
          <Pressable onPress={() => setAll((a) => !a)} accessibilityRole="button" accessibilityState={{ expanded: all }} hitSlop={6}>
            <Text style={{ color: c.accent, fontSize: 14 }}>{all ? t('tags.fewer') : t('tags.all', { count: others.length })}</Text>
          </Pressable>
          {all && <View style={styles.wrap}>{others.map((name) => chip(name, () => add(name)))}</View>}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  on: { paddingRight: 8 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  input: { flex: 1, paddingVertical: 8, fontSize: 15 },
})
