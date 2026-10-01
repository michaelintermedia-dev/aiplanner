import { FeedScreen } from '@/components/FeedScreen'

/** Feed: everything - tasks, events and notes together. */
export default function AllScreen() {
  return <FeedScreen kinds={[]} emptyText="Nothing here yet — hold the mic or type above to capture something." />
}
