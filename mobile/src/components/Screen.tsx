import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useColors } from '@/theme'

/** Scrollable screen body with pull-to-refresh that refetches all data. */
/** `bottomSpace`: extra room at the end, e.g. so content scrolls clear of a floating toolbar. */
export function Screen({ children, bottomSpace }: { children: ReactNode; bottomSpace?: number }) {
  const c = useColors()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, bottomSpace !== undefined && { paddingBottom: bottomSpace }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} />}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
})
