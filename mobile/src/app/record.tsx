import { Redirect } from 'expo-router'
import { useEffect } from 'react'
import { requestQuickRecording } from '@/lib/quickRecord'

/**
 * aiplanner://record - "Quick recording" (the home-screen widget): opens the
 * app on the feed with the capture toolbar recording at once.
 */
export default function QuickRecordScreen() {
  useEffect(() => requestQuickRecording(), [])
  return <Redirect href="/" />
}
