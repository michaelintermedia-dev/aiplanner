import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** The phone's "Remove animations" / Reduce motion setting: animations jump straight to their end. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])
  return reduce
}
