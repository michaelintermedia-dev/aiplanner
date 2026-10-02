import Ionicons from '@expo/vector-icons/Ionicons'
import { FEED_SORTS, feedGroupLabel, feedItemKey, groupFeed } from '@shared/feed'
import { activeFilterCount, feedFilterParams } from '@shared/feedFilter'
import type { FeedItem, FeedKind, FeedSort } from '@shared/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { useFeedFilters } from '@/lib/feedFilters'
import { useDebounced } from '@/lib/useDebounced'
import { useItemDeletion } from '@/lib/useItemDeletion'
import { DOCK_SPACE } from './CaptureDock'
import { FeedFilterBar } from './FeedFilterBar'
import { FeedRow } from './FeedRow'
import { Button } from './ui'
import { UndoToast } from './UndoToast'

type ListEntry = { type: 'header'; key: string; label: string } | { type: 'item'; key: string; item: FeedItem }

/**
 * The unified feed (tasks, events, notes), newest first by default. Each
 * bottom tab renders this with a different `kinds` filter. Virtualized and
 * paged: the next page loads as you approach the end.
 *
 * Long-press a row (or "Select") to pick several and delete them at once;
 * an Undo toast follows (same as the web).
 */
export function FeedScreen({ kinds, emptyText }: { kinds: FeedKind[]; emptyText: string }) {
  const c = useColors()
  const { zone } = useAuth()
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<FeedSort>('CreatedDesc')
  const [refreshing, setRefreshing] = useState(false)
  // One set of filters for every tab (switching tabs keeps them).
  const [filters, setFilters] = useFeedFilters()
  // Search as you type, but only ask the server once typing pauses.
  const text = useDebounced(filters.text)
  const filterParams = feedFilterParams({ ...filters, text }, zone.timeZone)
  const filtering = activeFilterCount(filters) > 0
  // null = not selecting; otherwise the picked rows by feedItemKey.
  const [selected, setSelected] = useState<Map<string, FeedItem> | null>(null)
  const deletion = useItemDeletion()
  const selecting = selected !== null

  // Leaving the tab ends selecting; so does Android's back button.
  useFocusEffect(useCallback(() => () => setSelected(null), []))
  useEffect(() => {
    if (!selecting) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null)
      return true
    })
    return () => sub.remove()
  }, [selecting])

  const feed = useInfiniteQuery({
    queryKey: ['feed', kinds, sort, filterParams],
    queryFn: ({ pageParam }) => feedApi.page({ kinds, sort, cursor: pageParam, filters: filterParams }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  // Flatten pages into rows with day headers in between.
  const entries = useMemo<ListEntry[]>(() => {
    const items = feed.data?.pages.flatMap((p) => p.items) ?? []
    return groupFeed(items, sort, zone.timeZone).flatMap((g) => [
      { type: 'header' as const, key: `h-${g.key}`, label: feedGroupLabel(g.key, zone) },
      ...g.items.map((item) => ({ type: 'item' as const, key: `${item.kind}-${item.id}`, item })),
    ])
  }, [feed.data, sort, zone])

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])
  const toggle = (item: FeedItem) =>
    setSelected((s) => {
      const next = new Map(s)
      const key = feedItemKey(item)
      if (next.has(key)) next.delete(key)
      else next.set(key, item)
      return next
    })
  const allSelected = selecting && items.length > 0 && selected.size === items.length

  const refresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const chooseSort = () =>
    Alert.alert('Sort by', undefined, [
      ...FEED_SORTS.map((s) => ({ text: s.sort === sort ? `✓ ${s.label}` : s.label, onPress: () => setSort(s.sort) })),
      { text: 'Close', style: 'cancel' as const },
    ])

  const sortLabel = FEED_SORTS.find((s) => s.sort === sort)?.label ?? 'Newest'

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ backgroundColor: c.bg }}
        stickyHeaderIndices={selecting ? [0] : undefined}
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(e) => e.key}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: entry }) =>
          entry.type === 'header' ? (
            <Text style={[styles.header, { color: c.muted }]}>{entry.label.toUpperCase()}</Text>
          ) : (
            <FeedRow
              item={entry.item}
              selection={selected ? { selected: selected.has(feedItemKey(entry.item)), onToggle: () => toggle(entry.item) } : undefined}
              onLongPress={() => setSelected(new Map([[feedItemKey(entry.item), entry.item]]))}
            />
          )
        }
        ListHeaderComponent={
          <View style={[styles.top, selecting && { backgroundColor: c.bg, paddingVertical: 4 }]}>
            {selected ? (
              <View style={[styles.selectionBar, { backgroundColor: c.surface, borderColor: c.accent }]} accessibilityLabel="Selected items">
                <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Stop selecting">
                  <Ionicons name="close" size={22} color={c.text} />
                </Pressable>
                <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '600' }}>{selected.size} selected</Text>
                <Button
                  title={allSelected ? 'Select none' : 'Select all'}
                  variant="link"
                  onPress={() => setSelected(allSelected ? new Map() : new Map(items.map((i) => [feedItemKey(i), i])))}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  busy={deletion.busy}
                  disabled={selected.size === 0}
                  onPress={() => deletion.deleteItems([...selected.values()], () => setSelected(null))}
                />
              </View>
            ) : (
              <FeedFilterBar
                filters={filters}
                onChange={setFilters}
                sortChip={
                  <Pressable onPress={chooseSort} style={[styles.sort, { borderColor: c.border, backgroundColor: c.surface }]} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}. Tap to change.`}>
                    <Text style={{ color: c.text }}>⇅ {sortLabel}</Text>
                  </Pressable>
                }
                selectChip={
                  <Pressable
                    onPress={() => setSelected(new Map())}
                    disabled={items.length === 0}
                    style={[styles.sort, styles.select, { borderColor: c.border, backgroundColor: c.surface }]}
                    accessibilityRole="button"
                    accessibilityLabel="Select items">
                    <Ionicons name="checkmark-circle-outline" size={16} color={c.text} />
                    <Text style={{ color: c.text }}>Select</Text>
                  </Pressable>
                }
              />
            )}
            {deletion.error && <Text style={{ color: c.danger }}>{deletion.error.message}</Text>}
            {feed.isPending && <Text style={{ color: c.muted }}>Loading…</Text>}
            {feed.error && <Text style={{ color: c.danger }}>{feed.error.message}</Text>}
            {feed.data && entries.length === 0 && <Text style={{ color: c.muted }}>{filtering ? 'Nothing matches these filters.' : emptyText}</Text>}
          </View>
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={c.muted} style={{ margin: 16 }} />
          ) : feed.data && !feed.hasNextPage && entries.length > 0 ? (
            <Text style={[styles.end, { color: c.muted }]}>That’s everything.</Text>
          ) : null
        }
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} />}
      />
      {deletion.deleted && <UndoToast deleted={deletion.deleted} onUndo={deletion.undo} onClose={deletion.hide} />}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: DOCK_SPACE },
  top: { gap: 12, marginBottom: 4 },
  sort: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  header: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: 10, marginBottom: 2 },
  end: { textAlign: 'center', fontSize: 13, margin: 16 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectionBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingLeft: 12, paddingRight: 4, minHeight: 50 },
})
