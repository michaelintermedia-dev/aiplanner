import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { refreshWidget } from '@/lib/appearance'
import { requestQuickRecording } from '@/lib/quickRecord'
import { claimTicket } from '@/widgets/recordTicket'

/**
 * aiplanner://record - "Quick recording" (the home-screen widget): opens the
 * app on the feed with the capture toolbar recording at once. Only for a real
 * tap: Android can replay the link when the app is later opened from its icon
 * (the ticket ?t= tells them apart - widgets/recordTicket.ts).
 */
export default function QuickRecordScreen() {
  const { t: ticket } = useLocalSearchParams<{ t?: string }>()
  useEffect(() => {
    if (!claimTicket(ticket)) return
    requestQuickRecording()
    refreshWidget() // the widget's next tap gets a new ticket
  }, [ticket])
  return <Redirect href="/" />
}
