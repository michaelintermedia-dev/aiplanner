import { FeedScreen } from '@/components/FeedScreen'
import { t } from '@shared/i18n'

/** Events = appointments. */
export default function EventsScreen() {
  return <FeedScreen kinds={['Appointment']} emptyText={t('feed.empty.events')} />
}
