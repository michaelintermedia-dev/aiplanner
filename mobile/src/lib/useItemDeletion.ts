import { UNDO_MS } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { useAction } from './useAction'

const refs = (items: FeedItem[]) => items.map((i) => ({ itemType: i.kind, id: i.id }))

/**
 * Deleting from the feed (same as the web): one or many items in one call, no
 * "are you sure" - instead an Undo toast for a few seconds after.
 */
export function useItemDeletion() {
  const [deleted, setDeleted] = useState<FeedItem[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const remove = useAction((items: FeedItem[]) => itemsApi.delete(refs(items)))
  const restore = useAction((items: FeedItem[]) => itemsApi.restore(refs(items)))

  useEffect(() => () => clearTimeout(timer.current), [])

  const hide = () => {
    clearTimeout(timer.current)
    setDeleted(null)
  }

  const deleteItems = (items: FeedItem[], onDone?: () => void) =>
    remove.mutate(items, {
      onSuccess: () => {
        clearTimeout(timer.current)
        setDeleted(items)
        timer.current = setTimeout(() => setDeleted(null), UNDO_MS)
        onDone?.()
      },
    })

  const undo = () => {
    if (deleted) restore.mutate(deleted)
    hide()
  }

  return { deleteItems, deleted, undo, hide, busy: remove.isPending, error: remove.error ?? restore.error }
}
