import type { FeedKind } from '@shared/types'
import { KIND_ICON } from './kindIcons'

export function KindIcon({ kind, className }: { kind: FeedKind; className?: string }) {
  const Icon = KIND_ICON[kind]
  return <Icon className={className} aria-hidden />
}
