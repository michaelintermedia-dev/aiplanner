import { FeedScreen } from '@/components/FeedScreen'
import { t } from '@shared/i18n'

export default function TasksScreen() {
  return <FeedScreen kinds={['Task']} emptyText={t('feed.empty.tasks')} />
}
