import { t } from '@shared/i18n'
import { DOCUMENT_ACCEPT, formatSize, isImageName, mediaProblem, photoName, splitMedia } from '@shared/media'
import type { Attachment, ItemType } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import {
  IoArrowUndoOutline,
  IoAttachOutline,
  IoCameraOutline,
  IoChevronBack,
  IoChevronForward,
  IoClose,
  IoDocumentTextOutline,
  IoImageOutline,
  IoImagesOutline,
} from 'react-icons/io5'
import { api } from '../api/endpoints'
import { saveBlob, shrinkImage, useAttachments, usePictureUrl, type PendingMedia } from '../lib/media'
import { useIsPhone } from '../lib/useIsPhone'

/** A stored picture (fetched once per session). */
function StoredImage({ id, alt }: { id: string; alt: string }) {
  const { url, failed } = usePictureUrl(id)
  if (failed) return <span className="media-missing">{t('media.loadFailed')}</span>
  return url ? <img src={url} alt={alt} /> : <span className="media-loading" />
}

/** The item's photos and documents, on its page (nothing when it has none). */
export function ItemMedia({ itemType, id }: { itemType: ItemType; id: string }) {
  const { data } = useAttachments(itemType, id)
  const [open, setOpen] = useState<number | null>(null)
  if (!data?.length) return null
  const { images, files } = splitMedia(data)

  return (
    <section className="card media" aria-label={t('media.title')}>
      <h2 className="source-heading">
        <IoImagesOutline aria-hidden /> {t('media.title')}
      </h2>
      {images.length > 0 && (
        <div className="media-grid">
          {images.map((a, i) => (
            <button key={a.id} type="button" className="media-thumb" onClick={() => setOpen(i)} aria-label={t('media.open', { name: a.fileName })} title={a.description ?? undefined}>
              <StoredImage id={a.id} alt={a.description ?? a.fileName} />
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && <FileList files={files} />}
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}

function FileList({ files, removed, onToggle }: { files: Attachment[]; removed?: string[]; onToggle?: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const download = async (a: Attachment) => {
    setError(null)
    try {
      saveBlob(await api.attachments.content(a.id), a.fileName)
    } catch {
      setError(t('media.loadFailed'))
    }
  }
  return (
    <>
      <ul className="media-files">
        {files.map((a) => {
          const gone = removed?.includes(a.id)
          return (
            <li key={a.id} className={gone ? 'removed' : undefined}>
              <button type="button" className="media-file" onClick={() => void download(a)} disabled={gone}>
                <IoDocumentTextOutline aria-hidden />
                <span className="media-file-name">
                  {a.fileName}
                  {a.description && <span className="media-description">{a.description}</span>}
                </span>
                <span className="muted small">{gone ? t('media.willBeRemoved') : formatSize(a.sizeBytes)}</span>
              </button>
              {onToggle && <RemoveToggle removed={!!gone} onClick={() => onToggle(a.id)} />}
            </li>
          )
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </>
  )
}

function RemoveToggle({ removed, onClick }: { removed: boolean; onClick: () => void }) {
  return (
    <button type="button" className="media-remove" onClick={onClick} aria-label={removed ? t('common.undo') : t('media.remove')} title={removed ? t('common.undo') : t('media.remove')}>
      {removed ? <IoArrowUndoOutline aria-hidden /> : <IoClose aria-hidden />}
    </button>
  )
}

/** One picture full screen; arrows (and ← →) step through them, Esc closes. */
function Lightbox({ images, index, onIndex, onClose }: { images: Attachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const step = (by: number) => onIndex((index + by + images.length) % images.length)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // In right-to-left languages "next" is to the left.
      const rtl = document.documentElement.dir === 'rtl'
      if (e.key === 'ArrowRight') step(rtl ? -1 : 1)
      if (e.key === 'ArrowLeft') step(rtl ? 1 : -1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const a = images[index]
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={a.fileName} onClick={onClose}>
      <div className="lightbox-image" onClick={(e) => e.stopPropagation()}>
        <StoredImage id={a.id} alt={a.description ?? a.fileName} />
      </div>
      {a.description && (
        <p className="lightbox-caption" onClick={(e) => e.stopPropagation()}>
          {a.description}
        </p>
      )}
      <button type="button" className="lightbox-close" onClick={onClose} aria-label={t('media.close')}>
        <IoClose aria-hidden />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="lightbox-prev" onClick={(e) => (e.stopPropagation(), step(-1))} aria-label="‹">
            <IoChevronBack className="flip-rtl" aria-hidden />
          </button>
          <button type="button" className="lightbox-next" onClick={(e) => (e.stopPropagation(), step(1))} aria-label="›">
            <IoChevronForward className="flip-rtl" aria-hidden />
          </button>
          <span className="lightbox-count">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * The Edit page's media part: what the item has (each can be marked for
 * removal), what was just picked (uploaded on Save), and the add buttons -
 * on a phone also "Take photo" (the browser opens the camera). Without an
 * item (the capture bar's drawer) only what's picked, added once it's saved.
 */
export function MediaEditor({
  itemType,
  id,
  pending,
  onPending,
  removed = [],
  onRemoved = () => {},
}: {
  itemType?: ItemType
  id?: string
  pending: PendingMedia[]
  onPending: (update: (p: PendingMedia[]) => PendingMedia[]) => void
  removed?: string[]
  onRemoved?: (ids: string[]) => void
}) {
  const phone = useIsPhone()
  const { data = [] } = useAttachments(itemType, id)
  const [problems, setProblems] = useState<string[]>([])
  const camera = useRef<HTMLInputElement>(null)
  const images = useRef<HTMLInputElement>(null)
  const documents = useRef<HTMLInputElement>(null)
  const { images: storedImages, files: storedFiles } = splitMedia(data)
  const toggle = (attachmentId: string) =>
    onRemoved(removed.includes(attachmentId) ? removed.filter((r) => r !== attachmentId) : [...removed, attachmentId])

  const add = async (list: FileList | null, fromCamera = false) => {
    if (!list?.length) return
    setProblems([])
    const found: string[] = []
    const added: PendingMedia[] = []
    for (const original of Array.from(list)) {
      // Read now: a picked file can come back empty once the picker is cleared
      // (or the file changes on disk) before Save. The camera names every
      // photo "image.jpg": give it a date instead.
      const named = new File([await original.arrayBuffer()], fromCamera ? photoName() : original.name, { type: original.type })
      const file = isImageName(named.name) ? await shrinkImage(named) : named
      const problem = mediaProblem(file.name, file.size)
      if (problem) {
        found.push(problem)
        continue
      }
      added.push({ key: crypto.randomUUID(), file, preview: isImageName(file.name) ? URL.createObjectURL(file) : undefined })
    }
    if (found.length) setProblems((p) => [...p, ...found])
    if (added.length) onPending((p) => [...p, ...added])
  }

  const unpick = (key: string) =>
    onPending((p) => {
      const gone = p.find((x) => x.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return p.filter((x) => x.key !== key)
    })

  const pendingImages = pending.filter((p) => p.preview)
  const pendingFiles = pending.filter((p) => !p.preview)

  return (
    <section className="edit-media" aria-label={t('media.title')}>
      <h4>
        <IoImagesOutline aria-hidden /> {t('media.title')}
      </h4>
      {(storedImages.length > 0 || pendingImages.length > 0) && (
        <div className="media-grid">
          {storedImages.map((a) => {
            const gone = removed.includes(a.id)
            return (
              <div key={a.id} className={`media-thumb${gone ? ' removed' : ''}`} title={gone ? t('media.willBeRemoved') : a.fileName}>
                <StoredImage id={a.id} alt={a.fileName} />
                <RemoveToggle removed={gone} onClick={() => toggle(a.id)} />
              </div>
            )
          })}
          {pendingImages.map((p) => (
            <div key={p.key} className="media-thumb pending" title={t('media.pending')}>
              <img src={p.preview} alt={p.file.name} />
              <RemoveToggle removed={false} onClick={() => unpick(p.key)} />
            </div>
          ))}
        </div>
      )}
      {storedFiles.length > 0 && <FileList files={storedFiles} removed={removed} onToggle={toggle} />}
      {pendingFiles.length > 0 && (
        <ul className="media-files">
          {pendingFiles.map((p) => (
            <li key={p.key} className="pending">
              <span className="media-file">
                <IoDocumentTextOutline aria-hidden />
                <span className="media-file-name">{p.file.name}</span>
                <span className="muted small">{t('media.pending')}</span>
              </span>
              <RemoveToggle removed={false} onClick={() => unpick(p.key)} />
            </li>
          ))}
        </ul>
      )}
      {problems.map((p) => (
        <p key={p} className="error">
          {p}
        </p>
      ))}
      <div className="media-add">
        {phone && (
          <button type="button" className="chip-button" onClick={() => camera.current?.click()}>
            <IoCameraOutline aria-hidden /> {t('media.takePhoto')}
          </button>
        )}
        <button type="button" className="chip-button" onClick={() => images.current?.click()}>
          <IoImageOutline aria-hidden /> {t('media.addImage')}
        </button>
        <button type="button" className="chip-button" onClick={() => documents.current?.click()}>
          <IoAttachOutline aria-hidden /> {t('media.addFile')}
        </button>
      </div>
      {/* The pickers themselves stay hidden; value is cleared so the same file can be picked again. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void add(e.target.files, true).finally(() => (e.target.value = ''))} />
      <input ref={images} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => void add(e.target.files).finally(() => (e.target.value = ''))} />
      <input ref={documents} type="file" accept={DOCUMENT_ACCEPT} multiple hidden onChange={(e) => void add(e.target.files).finally(() => (e.target.value = ''))} />
    </section>
  )
}
