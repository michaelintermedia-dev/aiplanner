import { FeedScreen } from '@/components/FeedScreen'

export default function TasksScreen() {
  return <FeedScreen kinds={['Task']} emptyText="No tasks yet." />
}
