import { deletedLabel } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import { IoClose } from 'react-icons/io5'

/** "3 items deleted · Undo" above the bottom bar (same as mobile). */
export function UndoToast({ deleted, onUndo, onClose }: { deleted: FeedItem[]; onUndo: () => void; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{deletedLabel(deleted)}</span>
      <button type="button" className="link toast-action" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Dismiss">
        <IoClose aria-hidden />
      </button>
    </div>
  )
}
