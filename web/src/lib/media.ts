import { t } from '@shared/i18n'
import { PHOTO_MAX_PX, PHOTO_QUALITY } from '@shared/media'
import type { ItemType } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/endpoints'

/** Small enough already: kept as it is (a screenshot stays a sharp PNG). */
const KEEP_UNDER_BYTES = 1.5 * 1024 * 1024

/**
 * A photo as it's uploaded: at most PHOTO_MAX_PX on its long side, as JPEG -
 * a 12 MB phone photo becomes a few hundred KB. Turned the right way up
 * (EXIF), transparent parts on white. GIFs are kept (they may move).
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // not something the browser can read - the server decides
  }
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= KEEP_UNDER_BYTES) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
  if (!blob) return file
  // Only big because of its bytes (not its size in pixels): keep whichever is smaller.
  if (scale === 1 && blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Saves a downloaded file under its name. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** A photo or document picked in the Edit page, uploaded on Save. */
export interface PendingMedia {
  key: string
  file: File
  /** For pictures: a local preview. */
  preview?: string
}

export const attachmentsKey = (itemType: ItemType, id: string) => ['attachments', itemType, id] as const

export function useAttachments(itemType: ItemType, id: string) {
  return useQuery({ queryKey: attachmentsKey(itemType, id), queryFn: () => api.attachments.list(itemType, id) })
}

/**
 * Save's media step: removals first, then uploads one by one. Each finished
 * upload leaves the pending list, so a failure part-way keeps only what's
 * still to do (Save again retries just that).
 */
export async function applyMedia(
  target: { itemType: ItemType; id: string },
  pending: PendingMedia[],
  removed: string[],
  done: { removed: () => void; uploaded: (key: string) => void },
) {
  for (const attachmentId of removed) {
    try {
      await api.attachments.remove(attachmentId)
    } catch (err) {
      if ((err as { status?: number }).status !== 404) throw err // already gone is fine
    }
  }
  done.removed()
  for (const p of pending) {
    const form = new FormData()
    form.append('file', p.file, p.file.name)
    try {
      await api.attachments.upload(target.itemType, target.id, form)
    } catch (err) {
      throw new Error(t('media.uploadFailed', { name: p.file.name, error: err instanceof Error ? err.message : String(err) }))
    }
    if (p.preview) URL.revokeObjectURL(p.preview)
    done.uploaded(p.key)
  }
}

// Pictures fetched this session, by attachment id. Not in the query cache:
// every save refreshes all queries, and a picture never changes.
const pictures = new Map<string, Promise<string>>()

/** A stored picture as a local URL (files need the sign-in, so they can't be linked directly). */
export function usePictureUrl(id: string): { url?: string; failed?: boolean } {
  const [state, setState] = useState<{ id: string; url?: string; failed?: boolean }>({ id })
  useEffect(() => {
    let live = true
    let picture = pictures.get(id)
    if (!picture) {
      picture = api.attachments.content(id).then((blob) => URL.createObjectURL(blob))
      pictures.set(id, picture)
      picture.catch(() => pictures.delete(id))
    }
    picture.then(
      (url) => live && setState({ id, url }),
      () => live && setState({ id, failed: true }),
    )
    return () => {
      live = false
    }
  }, [id])
  return state.id === id ? state : {}
}
