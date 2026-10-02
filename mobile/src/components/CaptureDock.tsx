import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dimensions, Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'

/**
 * The new-entry controls as a floating toolbar (mobile only, user's request):
 * open by default; the X or a touch anywhere on the screen behind it collapses
 * it into a round mic button, which opens it again. It stays open while
 * recording, processing or reviewing, so nothing in progress is hidden. The
 * bar stays mounted when collapsed, so typed text survives.
 *
 * It lifts itself above the on-screen keyboard: Android apps are edge-to-edge
 * now, so the window no longer shrinks for the keyboard and a panel anchored
 * to the bottom would be covered (KeyboardAvoidingView doesn't move an
 * absolutely positioned view either).
 */
export function CaptureDock({ children }: { children: ReactNode }) {
  const c = useColors()
  const [open, setOpen] = useState(true)
  const [engaged, setEngaged] = useState(false)
  const { ref, lift, roomAbove } = useKeyboardLift()

  const collapse = () => {
    if (!open || engaged) return
    Keyboard.dismiss()
    setOpen(false)
  }

  const maxHeight = Math.min(Dimensions.get('window').height * 0.7, roomAbove ?? Number.POSITIVE_INFINITY)

  return (
    <View style={styles.fill} ref={ref} collapsable={false}>
      {/* onTouchStart doesn't take the touch: the tap or scroll still happens. */}
      <View style={styles.fill} onTouchStart={collapse}>
        {children}
      </View>

      <View style={[styles.dock, { bottom: GAP + lift }]} pointerEvents="box-none">
        <View style={[styles.panel, !open && styles.hidden]}>
          <ScrollView style={{ maxHeight }} keyboardShouldPersistTaps="handled">
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
      </View>
    </View>
  )
}

/** Space between the toolbar and the bottom of the screen (or the keyboard). */
const GAP = 12

/**
 * How far the toolbar must rise to sit above the keyboard, and how much room
 * is left above it then. Measured against the dock's own area, so it's right
 * with or without a tab bar underneath.
 */
function useKeyboardLift() {
  const ref = useRef<View>(null)
  const [lift, setLift] = useState(0)
  const [roomAbove, setRoomAbove] = useState<number | null>(null)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => {
      ref.current?.measureInWindow((_x, top, _w, height) => {
        const keyboardTop = e.endCoordinates.screenY
        setLift(Math.max(0, top + height - keyboardTop))
        setRoomAbove(Math.max(160, keyboardTop - top - GAP * 3))
      })
    })
    const hide = Keyboard.addListener(hideEvent, () => {
      setLift(0)
      setRoomAbove(null)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return { ref, lift, roomAbove }
}

/** Room to leave under scrolling content so the last rows can scroll clear of the toolbar. */
export const DOCK_SPACE = 220

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { position: 'absolute', left: 12, right: 12, alignItems: 'flex-end' },
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
