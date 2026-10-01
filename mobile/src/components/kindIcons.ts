import type Ionicons from '@expo/vector-icons/Ionicons'
import type { FeedKind } from '@shared/types'
import type { ComponentProps } from 'react'

/** One icon per item type, used by the filter tabs and the feed rows alike. */
export const KIND_ICON: Record<FeedKind, ComponentProps<typeof Ionicons>['name']> = {
  Task: 'checkbox-outline',
  Appointment: 'time-outline',
  Note: 'document-text-outline',
}
