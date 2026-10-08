import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useSegments } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDockHidden } from '@/lib/dockTarget'
import { useQuickRecording } from '@/lib/quickRecord'
import { itemPath } from '@/lib/itemPath'
import type { SavedNotice } from '@shared/captureDraft'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { t } from '@shared/i18n'

/**
 * The new-entry controls as a floating toolbar over the whole app (mobile
 * only, user's request). Wraps the signed-in app, so it's on every screen and
 * a recording keeps going while you move around.
 *
 * Starts folded into its bubble; the X or a touch anywhere behind it folds it into a
 * round mic button that can be dragged anywhere (it snaps to the nearest side,
 * like Expo's dev-tools bubble) and opens it again on a tap. It stays open
 * while recording, processing or reviewing, and the bar stays mounted when
 * collapsed, so typed text survives.
 *
 * It steps aside on an item's screen, which has its own mic next to Edit
 * (lib/dockTarget) - unless a recording is going on. Coming back, it's as it
 * was (open or collapsed, typed text kept: it stays mounted).
 *
 * Collapsing shrinks the toolbar into the mic button and opening grows it back
 * out of it, wherever the button was dragged (skipped with Reduce motion).
 *
 * It lifts itself above the on-screen keyboard: Android apps are edge-to-edge,
 * so the window no longer shrinks for the keyboard.
 */
export function CaptureDock({ children }: { children: ReactNode }) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  // Starts folded into the bubble (user's call, 2026-10-08); a tap or Quick recording opens it.
  const [open, setOpen] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const keyboard = useKeyboardHeight()
  // Above the tab bar on the tab screens; above the system bar elsewhere.
  const inTabs = useSegments()[0] === '(tabs)'
  const base = insets.bottom + (inTabs ? TAB_BAR : 0)
  const bottom = GAP + Math.max(base, keyboard)

  // 1 = toolbar open, 0 = collapsed into the mic button; both are on screen while it moves.
  const [progress] = useState(() => new Animated.Value(0))
  // How far the toolbar's centre is from the button's (the toolbar shrinks into it).
  const [shift] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }))
  const [panelShown, setPanelShown] = useState(false)
  const [micShown, setMicShown] = useState(true)
  const panel = useRef<View>(null)
  const panelCentre = useRef<{ x: number; y: number } | null>(null)
  const micAt = useRef<{ x: number; y: number } | null>(null)
  const reduceMotion = useReduceMotion()

  const animate = (toOpen: boolean, done: () => void) => {
    const centre = panelCentre.current
    const mic = micAt.current
    shift.setValue(centre && mic ? { x: mic.x + FAB / 2 - centre.x, y: mic.y + FAB / 2 - centre.y } : { x: 0, y: 0 })
    Animated.timing(progress, {
      toValue: toOpen ? 1 : 0,
      duration: reduceMotion ? 0 : 260,
      easing: toOpen ? Easing.out(Easing.back(1.1)) : Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && done())
  }

  const collapse = () => {
    if (!open || engaged) return
    Keyboard.dismiss()
    setOpen(false)
    setMicShown(true)
    // Measured while fully open; reused to grow back out of the button.
    panel.current?.measureInWindow((x, y, w, h) => {
      if (w > 0) panelCentre.current = { x: x + w / 2, y: y + h / 2 }
      animate(false, () => setPanelShown(false))
    })
  }

  const expand = () => {
    setOpen(true)
    setPanelShown(true)
    animate(true, () => setMicShown(false))
  }

  // Quick recording (the home-screen widget): open up if folded; the bar starts recording.
  const quick = useQuickRecording()
  const seenQuick = useRef(0)
  useEffect(() => {
    if (quick === seenQuick.current) return
    seenQuick.current = quick
    if (!open) queueMicrotask(expand)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new request
  }, [quick])

  // Something started in the bar while folded: open up (same as the web).
  useEffect(() => {
    if (engaged && !open) queueMicrotask(expand)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the bar becomes busy
  }, [engaged])

  // A capture is done (saved or cancelled): fold into the bubble once the bar is
  // idle again, and say what it was saved as for a moment (with Open).
  const [notice, setNotice] = useState<SavedNotice | null>(null)
  const foldWhenIdle = useRef(false)
  const finished = useCallback((saved: SavedNotice | null) => {
    foldWhenIdle.current = true
    setNotice(saved)
  }, [])
  useEffect(() => {
    if (engaged || !foldWhenIdle.current) return
    foldWhenIdle.current = false
    queueMicrotask(collapse)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the bar becomes idle
  }, [engaged])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // An item's screen has its own mic: the dock steps aside there (not mid-recording).
  const hidden = useDockHidden() && !engaged

  const onMicRest = useCallback((at: { x: number; y: number }) => {
    micAt.current = at
  }, [])

  const panelMotion = useMemo(() => {
    const away = Animated.subtract(1, progress) // 0 open .. 1 collapsed
    return {
      opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 1] }),
      transform: [
        { translateX: Animated.multiply(away, shift.x) },
        { translateY: Animated.multiply(away, shift.y) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) },
      ],
    }
  }, [progress, shift])

  return (
    <View style={styles.fill}>
      {/* onTouchStart doesn't take the touch: the tap or scroll still happens. */}
      <View style={styles.fill} onTouchStart={collapse}>
        {children}
      </View>

      <View style={[styles.dock, { bottom }, hidden && styles.hidden]} pointerEvents="box-none">
        <Animated.View
          ref={panel}
          style={[styles.panel, !panelShown && styles.hidden, panelMotion]}
          pointerEvents={open ? 'auto' : 'none'}>
          <ScrollView style={{ maxHeight: Math.max(160, (height - bottom - insets.top) * 0.85) }} keyboardShouldPersistTaps="handled">
            <CaptureBar onEngagedChange={setEngaged} talkSignal={quick} onFinished={finished} />
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
        </Animated.View>
      </View>

      {notice && !open && (
        <View style={[styles.notice, { bottom, backgroundColor: c.text }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={{ color: c.bg, flexShrink: 1 }} numberOfLines={2}>
            {notice.message}
          </Text>
          {notice.item && (
            <Pressable
              onPress={() => {
                router.push(itemPath(notice.item!) as never)
                setNotice(null)
              }}
              hitSlop={10}
              accessibilityRole="link">
              <Text style={{ color: c.accentSoft, fontWeight: '700' }}>{t('capture.open')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Always mounted (hidden while open), so it remembers where it was dragged. */}
      <DraggableMic
        visible={micShown && !hidden}
        interactive={!open}
        progress={progress}
        onOpen={expand}
        onRest={onMicRest}
      />
    </View>
  )
}

/** How long "Saved as ..." stays up after the dock folds away. */
const NOTICE_MS = 5000
/** Approximate bottom tab bar height (without the system inset). */
const TAB_BAR = 56
/** Space between the toolbar and whatever is under it. */
const GAP = 12
const FAB = 56
const EDGE = 12

/** The system "Reduce motion" setting: animations then jump straight to the end. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])
  return reduce
}

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
function DraggableMic({
  visible,
  interactive,
  progress,
  onOpen,
  onRest,
}: {
  visible: boolean
  /** False while the toolbar is open (the button is only fading out). */
  interactive: boolean
  /** The dock's open/closed animation: the button pops in as the toolbar shrinks into it. */
  progress: Animated.Value
  onOpen: () => void
  /** Where the button rests (top-left, in the dock) - the toolbar grows out of it. */
  onRest: (at: { x: number; y: number }) => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [start] = useState(() => ({ x: width - FAB - EDGE, y: height - FAB - insets.bottom - TAB_BAR - GAP * 2 }))
  const [position] = useState(() => new Animated.ValueXY(start))
  const at = useRef(start) // where it rests (read and written in the touch handlers only)
  const moved = useRef(false)
  // Where it rests now (not where it started: a remount keeps the dragged spot).
  useEffect(() => onRest(at.current), [onRest])

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
            onOpen() // a tap, not a drag
            return
          }
          const x = at.current.x + g.dx + FAB / 2 < width / 2 ? EDGE : width - FAB - EDGE
          const y = Math.min(Math.max(at.current.y + g.dy, insets.top + EDGE), height - FAB - insets.bottom - EDGE)
          at.current = { x, y }
          onRest(at.current)
          Animated.spring(position, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start()
        },
      }),
    [position, onOpen, onRest, width, height, insets.top, insets.bottom],
  )

  // Two layers: the drag moves the outer one (JS-driven), the pop in/out scales
  // the inner one (native-driven) - one view can't take both kinds of animation.
  return (
    <Animated.View
      {...responder.panHandlers}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[styles.fabSpot, !visible && styles.hidden, { transform: position.getTranslateTransform() }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('dock.newEntry')}
      accessibilityHint={t('dock.dragHint')}
      onAccessibilityTap={onOpen}>
      <Animated.View
        style={[
          styles.fab,
          {
            backgroundColor: c.accent,
            opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 0] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }],
          },
        ]}>
        <Ionicons name="mic" size={26} color="#fff" />
      </Animated.View>
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
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
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
  fabSpot: { position: 'absolute', left: 0, top: 0, width: FAB, height: FAB },
  fab: {
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
