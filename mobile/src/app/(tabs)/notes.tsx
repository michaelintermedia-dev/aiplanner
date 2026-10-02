import { FeedScreen } from '@/components/FeedScreen'
import { t } from '@shared/i18n'

export default function NotesScreen() {
  return <FeedScreen kinds={['Note']} emptyText={t('feed.empty.notes')} />
}
