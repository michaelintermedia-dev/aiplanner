import Ionicons from '@expo/vector-icons/Ionicons'
import { useSegments } from 'expo-router'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { t } from '@shared/i18n'

/**
 * The new-entry controls as a floating toolbar over the whole app (mobile
 * only, user's request). Wraps the signed-in app, so it's on every screen and
 * a recording keeps going while you move around.
 *
 * Open by default; the X or a touch anywhere behind it collapses it into a
 * round mic button that can be dragged anywhere (it snaps to the nearest side,
 * like Expo's dev-tools bubble) and opens it again on a tap. It stays open
 * while recording, processing or reviewing, and the bar stays mounted when
 * collapsed, so typed text survives.
 *
 * It lifts itself above the on-screen keyboard: Android apps are edge-to-edge,
 * so the window no longer shrinks for the keyboard.
 */
export function CaptureDock({ children }: { children: ReactNode }) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(true)
  const [engaged, setEngaged] = useState(false)
  const keyboard = useKeyboardHeight()
  // Above the tab bar on the tab screens; above the system bar elsewhere.
  const inTabs = useSegments()[0] === '(tabs)'
  const base = insets.bottom + (inTabs ? TAB_BAR : 0)
  const bottom = GAP + Math.max(base, keyboard)

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

      <View style={[styles.dock, { bottom }]} pointerEvents="box-none">
        <View style={[styles.panel, !open && styles.hidden]}>
          <ScrollView style={{ maxHeight: Math.max(160, (height - bottom - insets.top) * 0.85) }} keyboardShouldPersistTaps="handled">
            <CaptureBar onEngagedChange={setEngaged} />
          </ScrollView>
          {!engaged && (
            <Pressable
              onPress={collapse}
              hitSlop={10}
              style={[styles.close, { backgroundColor: c.surface2, borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('dock.hide')}>
              <Ionicons name="close" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Always mounted (hidden while open), so it remembers where it was dragged. */}
      <DraggableMic visible={!open} onOpen={setOpen} />
    </View>
  )
}

/** Approximate bottom tab bar height (without the system inset). */
const TAB_BAR = 56
/** Space between the toolbar and whatever is under it. */
const GAP = 12
const FAB = 56
const EDGE = 12

/** Keyboard height while it's up (0 when hidden). */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0)
  const { height: window } = useWindowDimensions()
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => setHeight(Math.max(0, window - e.endCoordinates.screenY)))
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [window])
  return height
}

/** The collapsed toolbar: a mic button you can drag anywhere; it snaps to the nearest side. */
function DraggableMic({ visible, onOpen }: { visible: boolean; onOpen: (open: true) => void }) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [start] = useState(() => ({ x: width - FAB - EDGE, y: height - FAB - insets.bottom - TAB_BAR - GAP * 2 }))
  const [position] = useState(() => new Animated.ValueXY(start))
  const at = useRef(start) // where it rests (read and written in the touch handlers only)
  const moved = useRef(false)

  const responder = useMemo(
    () =>
      // The refs are only read inside the touch callbacks, never during render;
      // the compiler can't tell PanResponder's handlers apart from render code.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          moved.current = false
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved.current = true
          position.setValue({ x: at.current.x + g.dx, y: at.current.y + g.dy })
        },
        onPanResponderRelease: (_e, g) => {
          if (!moved.current) {
            position.setValue(at.current)
            onOpen(true) // a tap, not a drag
            return
          }
          const x = at.current.x + g.dx + FAB / 2 < width / 2 ? EDGE : width - FAB - EDGE
          const y = Math.min(Math.max(at.current.y + g.dy, insets.top + EDGE), height - FAB - insets.bottom - EDGE)
          at.current = { x, y }
          Animated.spring(position, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start()
        },
      }),
    [position, onOpen, width, height, insets.top, insets.bottom],
  )

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.fab, !visible && styles.hidden, { backgroundColor: c.accent, transform: position.getTranslateTransform() }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('dock.newEntry')}
      accessibilityHint={t('dock.dragHint')}
      onAccessibilityTap={() => onOpen(true)}>
      <Ionicons name="mic" size={26} color="#fff" />
    </Animated.View>
  )
}

/** Room to leave under scrolling content so the last rows can scroll clear of the toolbar. */
export const DOCK_SPACE = 220

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { position: 'absolute', left: 12, right: 12 },
  panel: {
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
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})
