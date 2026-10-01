import { FeedScreen } from '@/components/FeedScreen'

/** Events = appointments. */
export default function EventsScreen() {
  return <FeedScreen kinds={['Appointment']} emptyText="No events yet." />
}
