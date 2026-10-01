import type { FeedKind } from '@shared/types'
import type { IconType } from 'react-icons'
import { IoCheckboxOutline, IoDocumentTextOutline, IoTimeOutline } from 'react-icons/io5'

/** One icon per item type, used by the filter tabs, feed rows and calendar alike. */
export const KIND_ICON: Record<FeedKind, IconType> = {
  Task: IoCheckboxOutline,
  Appointment: IoTimeOutline,
  Note: IoDocumentTextOutline,
}
