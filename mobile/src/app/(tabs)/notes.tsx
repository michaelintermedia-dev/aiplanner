import { FeedScreen } from '@/components/FeedScreen'

export default function NotesScreen() {
  return <FeedScreen kinds={['Note']} emptyText="No notes yet. Say “note: …” or type it above." />
}
