import { t } from './i18n'
import type { Attachment } from './types'

/**
 * An item's media (photos, documents): the same rules as the server's
 * AttachmentRules, so a file that would be refused is caught before uploading.
 */

/** Per file (photos are shrunk on the device first). */
export const MAX_FILE_MB = 20
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
/** Photos are scaled down to fit this many pixels on their long side. */
export const PHOTO_MAX_PX = 2000
export const PHOTO_QUALITY = 0.8

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const FILE_EXT = ['heic', 'heif', 'pdf', 'txt', 'csv', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']

/** For file pickers: the document types that can be attached. */
export const DOCUMENT_ACCEPT = FILE_EXT.map((e) => `.${e}`).join(',')
export const DOCUMENT_MIME = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'image/heic',
  'image/heif',
]

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** Shown as a picture (rather than a file to open). */
export const isImageName = (name: string) => IMAGE_EXT.includes(extension(name))

/** Why this file can't be attached, or null when it can. */
export function mediaProblem(name: string, sizeBytes: number): string | null {
  const ext = extension(name)
  if (!IMAGE_EXT.includes(ext) && !FILE_EXT.includes(ext)) return t('media.notAllowed', { name })
  if (sizeBytes > MAX_FILE_BYTES) return t('media.tooBig', { name, max: MAX_FILE_MB })
  return null
}

/** "340 KB", "2.4 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Images first (as a grid), then documents (as a list); voice clips have their own place. */
export function splitMedia(items: Attachment[]) {
  return {
    images: items.filter((a) => a.kind === 'Image'),
    files: items.filter((a) => a.kind === 'File'),
  }
}

/** A name for a photo taken with the camera. */
export function photoName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `Photo ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}.${p(now.getMinutes())}.${p(now.getSeconds())}.jpg`
}
