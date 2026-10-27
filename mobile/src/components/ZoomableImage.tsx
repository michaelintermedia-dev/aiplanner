import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const MAX = 5
const DOUBLE_TAP = 2.5

/**
 * A full-screen picture you can zoom (2026-10-27, user's request): pinch,
 * double-tap to zoom in at that spot (again to fit), drag to look around while
 * zoomed. A single tap is passed on (the viewer hides its controls). While
 * zoomed, the viewer stops swiping to the next picture (onZoomChange).
 * Runs on the UI thread (Reanimated), so it follows the fingers.
 */
export function ZoomableImage({
  width,
  height,
  onZoomChange,
  onTap,
  children,
}: {
  width: number
  height: number
  onZoomChange: (zoomed: boolean) => void
  onTap: () => void
  children: ReactNode
}) {
  // Dragging only while zoomed - otherwise a one-finger swipe goes to the next picture.
  const [zoomed, setZoomedState] = useState(false)
  const setZoomed = useCallback((z: boolean) => {
    setZoomedState(z)
    onZoomChange(z)
  }, [onZoomChange])
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)

  // Leaving the picture (another one shown) starts it fitted again.
  useEffect(() => () => onZoomChange(false), [onZoomChange])

  const clamp = (value: number, limit: number) => {
    'worklet'
    return Math.min(limit, Math.max(-limit, value))
  }
  const settle = (s: number) => {
    'worklet'
    const limitX = (width * (s - 1)) / 2
    const limitY = (height * (s - 1)) / 2
    x.value = withTiming(clamp(x.value, limitX))
    y.value = withTiming(clamp(y.value, limitY))
    savedX.value = clamp(x.value, limitX)
    savedY.value = clamp(y.value, limitY)
  }
  const reset = () => {
    'worklet'
    scale.value = withTiming(1)
    savedScale.value = 1
    x.value = withTiming(0)
    y.value = withTiming(0)
    savedX.value = 0
    savedY.value = 0
    runOnJS(setZoomed)(false)
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX, Math.max(0.8, savedScale.value * e.scale))
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        reset()
        return
      }
      savedScale.value = scale.value
      settle(scale.value)
      runOnJS(setZoomed)(true)
    })

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return
      x.value = savedX.value + e.translationX
      y.value = savedY.value + e.translationY
    })
    .onEnd(() => {
      if (savedScale.value <= 1) return
      settle(savedScale.value)
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1) {
        reset()
        return
      }
      // Zoom in at the tapped spot.
      const s = DOUBLE_TAP
      scale.value = withTiming(s)
      savedScale.value = s
      const tx = clamp((width / 2 - e.x) * (s - 1), (width * (s - 1)) / 2)
      const ty = clamp((height / 2 - e.y) * (s - 1), (height * (s - 1)) / 2)
      x.value = withTiming(tx)
      y.value = withTiming(ty)
      savedX.value = tx
      savedY.value = ty
      runOnJS(setZoomed)(true)
    })

  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => {
      runOnJS(onTap)()
    })

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap))}>
      <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>
    </GestureDetector>
  )
}
