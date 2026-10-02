import Ionicons from '@expo/vector-icons/Ionicons'
import { deletedLabel } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'

/** "3 items deleted · Undo", floating at the top of the feed (same as the web). */
export function UndoToast({ deleted, onUndo, onClose }: { deleted: FeedItem[]; onUndo: () => void; onClose: () => void }) {
  const c = useColors()
  return (
    <View style={[styles.toast, { backgroundColor: c.text }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={{ color: c.bg, fontSize: 15 }}>{deletedLabel(deleted)}</Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.undo')}>
        <Text style={{ color: c.accentSoft, fontSize: 15, fontWeight: '700' }}>{t('common.undo')}</Text>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.dismiss')}>
        <Ionicons name="close" size={18} color={c.bg} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 18,
    paddingRight: 12,
    minHeight: 44,
    borderRadius: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})
