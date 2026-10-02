import { FeedScreen } from '@/components/FeedScreen'
import { t } from '@shared/i18n'

/** Feed: everything - tasks, events and notes together. */
export default function AllScreen() {
  return <FeedScreen kinds={[]} emptyText={t('feed.empty.all')} />
}
