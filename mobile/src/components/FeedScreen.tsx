import { FEED_SORTS, feedGroupLabel, groupFeed } from '@shared/feed'
import { activeFilterCount, feedFilterParams } from '@shared/feedFilter'
import type { FeedItem, FeedKind, FeedSort } from '@shared/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { useFeedFilters } from '@/lib/feedFilters'
import { useDebounced } from '@/lib/useDebounced'
import { DOCK_SPACE } from './CaptureDock'
import { FeedFilterBar } from './FeedFilterBar'
import { FeedRow } from './FeedRow'

type ListEntry = { type: 'header'; key: string; label: string } | { type: 'item'; key: string; item: FeedItem }

/**
 * The unified feed (tasks, events, notes), newest first by default. Each
 * bottom tab renders this with a different `kinds` filter. Virtualized and
 * paged: the next page loads as you approach the end.
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
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(e) => e.key}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: entry }) =>
        entry.type === 'header' ? (
          <Text style={[styles.header, { color: c.muted }]}>{entry.label.toUpperCase()}</Text>
        ) : (
          <FeedRow item={entry.item} />
        )
      }
      ListHeaderComponent={
        <View style={styles.top}>
          <FeedFilterBar
            filters={filters}
            onChange={setFilters}
            sortChip={
              <Pressable onPress={chooseSort} style={[styles.sort, { borderColor: c.border, backgroundColor: c.surface }]} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}. Tap to change.`}>
                <Text style={{ color: c.text }}>⇅ {sortLabel}</Text>
              </Pressable>
            }
          />
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
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: DOCK_SPACE },
  top: { gap: 12, marginBottom: 4 },
  sort: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  header: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: 10, marginBottom: 2 },
  end: { textAlign: 'center', fontSize: 13, margin: 16 },
})
