import Ionicons from '@expo/vector-icons/Ionicons'
import { feedGroupLabel, feedItemKey, groupFeed } from '@shared/feed'
import { feedFilterParams, isFiltering, kindsOf } from '@shared/feedFilter'
import { feedSorts } from '@shared/feedOrder'
import { searchWords } from '@shared/highlight'
import { t } from '@shared/i18n'
import type { FeedItem } from '@shared/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { feedApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useFeedFilters } from '@/lib/feedFilters'
import { useFeedOrder } from '@/lib/feedOrder'
import { useDebounced } from '@/lib/useDebounced'
import { useItemDeletion } from '@/lib/useItemDeletion'
import { useColors } from '@/theme'
import { DOCK_SPACE } from './CaptureDock'
import { EmailConfirmBanner } from './EmailConfirmBanner'
import { FeedChipBar } from './FeedChipBar'
import { FeedRow } from './FeedRow'
import { Button } from './ui'
import { UndoToast } from './UndoToast'

type ListEntry =
  | { type: 'header'; key: string; label: string; done?: { count: number } }
  | { type: 'item'; key: string; item: FeedItem }

const EMPTY_KEYS = { all: 'feed.empty.all', tasks: 'feed.empty.tasks', events: 'feed.empty.events', notes: 'feed.empty.notes' } as const

/**
 * The feed (spec v2, same as the web): tasks, events and notes in one list,
 * Smart order by default - Overdue, Today, Upcoming, No date, Notes, then Done
 * folded away - or the order picked in ⚙. The chip row narrows it.
 * Virtualized and paged: the next page loads as you approach the end.
 *
 * Long-press a row (or "Select" in ⚙) to pick several and delete them at once;
 * an Undo toast follows (same as the web).
 */
export function FeedScreen() {
  const c = useColors()
  const { zone } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  // One set of filters (kept while moving around the app); the order is kept on the phone.
  const [filters, setFilters] = useFeedFilters()
  const [order, setOrder] = useFeedOrder()
  // Search as you type, but only ask the server once typing pauses.
  const text = useDebounced(filters.text)
  const sort = useMemo(() => feedSorts(!!text.trim(), order), [text, order])
  const smart = sort[0] === 'Smart'
  const kinds = useMemo(() => kindsOf(filters.show), [filters.show])
  const filterParams = feedFilterParams({ ...filters, text }, zone.timeZone)
  const words = useMemo(() => searchWords(text), [text])
  // Done stays folded until asked for.
  const [showDone, setShowDone] = useState(false)
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

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])
  const counts = feed.data?.pages[0]?.sections ?? null
  // Folded Done: no need to load its pages.
  const doneFolded = smart && !showDone && items[items.length - 1]?.section === 'Done'

  // Flatten pages into rows with section/day headers in between (folded Done: its header only).
  const entries = useMemo<ListEntry[]>(
    () =>
      groupFeed(items, sort, zone.timeZone).flatMap((g) => {
        const isDone = g.key === 's:Done'
        const header: ListEntry = {
          type: 'header',
          key: `h-${g.key}`,
          label: feedGroupLabel(g.key, zone),
          ...(isDone ? { done: { count: counts?.Done ?? g.items.length } } : {}),
        }
        if (isDone && !showDone) return [header]
        return [header, ...g.items.map((item) => ({ type: 'item' as const, key: `${item.kind}-${item.id}`, item }))]
      }),
    [items, sort, zone, counts, showDone],
  )

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

  const headerStyle = [styles.header, { color: c.muted }, c.pill && { ...c.pill, alignSelf: 'flex-start' as const }]

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {/* Floats over the top of the list (the chips keep their place, dimmed), so nothing shifts when selecting starts. */}
      {selected && (
        <View style={[styles.selectionBar, { backgroundColor: c.surface, borderColor: c.accent }]} accessibilityLabel={t('select.bar')}>
          <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('select.stop')}>
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
          <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '600' }}>{t('select.count', { count: selected.size })}</Text>
          <Button
            title={allSelected ? t('select.none') : t('select.all')}
            variant="link"
            onPress={() => setSelected(allSelected ? new Map() : new Map(items.map((i) => [feedItemKey(i), i])))}
          />
          <Button
            title={t('common.delete')}
            variant="danger"
            busy={deletion.busy}
            disabled={selected.size === 0}
            onPress={() => deletion.deleteItems([...selected.values()], () => setSelected(null))}
          />
        </View>
      )}
      <FlatList
        style={{ backgroundColor: c.page }}
        // Rows depend on the selection too, not only on `data`.
        extraData={[selected, words]}
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(e) => e.key}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: entry }) =>
          entry.type === 'header' ? (
            entry.done ? (
              <Pressable
                onPress={() => setShowDone((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDone }}
                accessibilityLabel={`${entry.label} (${entry.done.count}). ${showDone ? t('feed.hideDone') : t('feed.showDone')}`}
                style={[styles.doneHeader, c.pill && { ...c.pill, alignSelf: 'flex-start' }]}>
                <Ionicons
                  name={showDone ? 'chevron-down' : I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={14}
                  color={c.muted}
                />
                <Text style={[styles.header, styles.headerInline, { color: c.muted }]}>
                  {entry.label.toUpperCase()} ({entry.done.count})
                </Text>
              </Pressable>
            ) : (
              <Text style={headerStyle}>{entry.label.toUpperCase()}</Text>
            )
          ) : (
            <FeedRow
              item={entry.item}
              words={words}
              selection={selected ? { selected: selected.has(feedItemKey(entry.item)), onToggle: () => toggle(entry.item) } : undefined}
              onLongPress={() => setSelected(new Map([[feedItemKey(entry.item), entry.item]]))}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.top}>
            <EmailConfirmBanner />
            <View style={selected && styles.dimmed} pointerEvents={selected ? 'none' : 'auto'}>
              <FeedChipBar
                filters={filters}
                onChange={setFilters}
                order={order}
                onOrder={setOrder}
                onSelect={() => setSelected(new Map())}
                canSelect={items.length > 0}
              />
            </View>
            {deletion.error && <Text style={[{ color: c.danger }, c.pillStart]}>{deletion.error.message}</Text>}
            {feed.isPending && <Text style={[{ color: c.muted }, c.pillStart]}>{t('common.loading')}</Text>}
            {feed.error && <Text style={[{ color: c.danger }, c.pillStart]}>{feed.error.message}</Text>}
            {feed.data && entries.length === 0 && (
              <Text style={[{ color: c.muted }, c.pillStart]}>{isFiltering(filters) ? t('feed.noMatches') : t(EMPTY_KEYS[filters.show])}</Text>
            )}
          </View>
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={c.muted} style={{ margin: 16 }} />
          ) : feed.data && !feed.hasNextPage && entries.length > 0 && !doneFolded ? (
            <Text style={[styles.end, { color: c.muted }, c.pill && { ...c.pill, alignSelf: 'center' }]}>{t('feed.end')}</Text>
          ) : null
        }
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && !doneFolded && void feed.fetchNextPage()}
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
  header: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: 10, marginBottom: 2 },
  headerInline: { marginTop: 0, marginBottom: 0 },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, marginBottom: 2, minHeight: 32 },
  end: { textAlign: 'center', fontSize: 13, margin: 16 },
  selectionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    margin: 16,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: 50,
  },
  dimmed: { opacity: 0.35 },
})
