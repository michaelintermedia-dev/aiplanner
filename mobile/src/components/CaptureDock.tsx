import Ionicons from '@expo/vector-icons/Ionicons'
import { useState, type ReactNode } from 'react'
import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'

/**
 * The new-entry controls as a floating toolbar (mobile only, user's request):
 * open by default; the X or a touch anywhere on the screen behind it collapses
 * it into a round mic button, which opens it again. It stays open while
 * recording, processing or reviewing, so nothing in progress is hidden. The
 * bar stays mounted when collapsed, so typed text survives.
 */
export function CaptureDock({ children }: { children: ReactNode }) {
  const c = useColors()
  const [open, setOpen] = useState(true)
  const [engaged, setEngaged] = useState(false)

  const collapse = () => {
    if (!open || engaged) return
    Keyboard.dismiss()
    setOpen(false)
  }

  return (
    <View style={styles.fill}>
      {/* onTouchStart doesn't take the touch: the tap or scroll still happens. */}
      <View style={styles.fill} onTouchStart={collapse}>
        {children}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dock} pointerEvents="box-none">
        <View style={[styles.panel, !open && styles.hidden]}>
          <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.7 }} keyboardShouldPersistTaps="handled">
            <CaptureBar onEngagedChange={setEngaged} />
          </ScrollView>
          {!engaged && (
            <Pressable
              onPress={collapse}
              hitSlop={10}
              style={[styles.close, { backgroundColor: c.surface2, borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel="Hide new entry">
              <Ionicons name="close" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>

        {!open && (
          <Pressable
            onPress={() => setOpen(true)}
            style={[styles.fab, { backgroundColor: c.accent }]}
            accessibilityRole="button"
            accessibilityLabel="New entry">
            <Ionicons name="mic" size={26} color="#fff" />
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}

/** Room to leave under scrolling content so the last rows can scroll clear of the toolbar. */
export const DOCK_SPACE = 220

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'flex-end' },
  panel: {
    alignSelf: 'stretch',
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  hidden: { display: 'none' },
  close: {
    position: 'absolute',
    top: -10,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})
