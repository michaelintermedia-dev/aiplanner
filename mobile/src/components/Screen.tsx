import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useColors } from '@/theme'
import { DOCK_SPACE } from './CaptureDock'

/** Scrollable screen body with pull-to-refresh that refetches all data. */
/** Room at the end so the content can scroll clear of the floating new-entry toolbar. */
export function Screen({ children, bottomSpace = DOCK_SPACE }: { children: ReactNode; bottomSpace?: number }) {
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
      style={{ backgroundColor: c.page }}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} />}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
})
