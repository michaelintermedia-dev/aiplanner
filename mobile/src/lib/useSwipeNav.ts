import { useCallback, useMemo, useRef } from 'react'
import { I18nManager, useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useReduceMotion } from './useReduceMotion'

/**
 * Swipe sideways to go to the next / previous period (the calendar, user's
 * request 2026-10-31): the content follows the finger, and a long or quick
 * enough swipe slides it out and the new one in. Finger to the left = next
 * (to the right in right-to-left languages, like the arrows). Mostly-vertical
 * moves stay with the scroll view; taps are untouched.
 *
 * Returns `count` gestures (one per GestureDetector - a gesture can't be
 * shared) that move the same `style`, so several parts slide together.
 */
export function useSwipeNav(onSwipe: (direction: 1 | -1) => void, count = 1) {
  const { width } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const offset = useSharedValue(0)
  const latest = useRef(onSwipe)
  latest.current = onSwipe
  const go = useCallback((direction: 1 | -1) => latest.current(direction), [])

  const gestures = useMemo(() => {
    const rtl = I18nManager.isRTL
    const make = () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          offset.value = e.translationX * 0.6
        })
        .onEnd((e) => {
          const far = Math.abs(e.translationX) > width * 0.18 || Math.abs(e.velocityX) > 700
          if (!far) {
            offset.value = withTiming(0, { duration: 150 })
            return
          }
          const left = e.translationX < 0
          const direction = left !== rtl ? 1 : -1
          if (reduceMotion) {
            offset.value = 0
            runOnJS(go)(direction)
            return
          }
          const out = (left ? -width : width) * 0.5
          offset.value = withTiming(out, { duration: 110 }, () => {
            runOnJS(go)(direction)
            // The new period comes in from the other side.
            offset.value = -out
            offset.value = withTiming(0, { duration: 170 })
          })
        })
    return Array.from({ length: count }, make)
  }, [count, width, reduceMotion, go, offset])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    opacity: 1 - Math.min(Math.abs(offset.value) / width, 0.6),
  }))

  return { gestures, style }
}
