import { t } from '@shared/i18n'
import { DOCUMENT_MIME, isImageName, mediaProblem, PHOTO_MAX_PX, PHOTO_QUALITY, photoName } from '@shared/media'
import type { Attachment, ItemType } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import * as IntentLauncher from 'expo-intent-launcher'
import * as MediaLibrary from 'expo-media-library/legacy'
import { AppState, Linking, Platform } from 'react-native'
import * as Sharing from 'expo-sharing'
import { API_URL, getAccessToken } from '@/api/client'
import { api } from '@/api/endpoints'

/** A photo or document picked in the Edit screen, uploaded on Save. Same as the web's. */
export interface PendingMedia {
  key: string
  uri: string
  name: string
  isImage: boolean
}

export const attachmentsKey = (itemType: ItemType, id: string) => ['attachments', itemType, id] as const

/** An item's stored media (none when there's no item yet - a new entry in the capture bar). */
export function useAttachments(itemType: ItemType | undefined, id: string | undefined) {
  return useQuery({
    queryKey: attachmentsKey(itemType ?? 'Task', id ?? ''),
    queryFn: () => api.attachments.list(itemType!, id!),
    enabled: !!itemType && !!id,
  })
}

/** Where a stored attachment is (pictures load straight from it, with the sign-in header). */
export const attachmentSource = (id: string) => ({
  uri: `${API_URL}/api/attachments/${id}/content`,
  headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
})

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * A photo as it's uploaded: at most PHOTO_MAX_PX on its long side, JPEG -
 * same as the web. GIFs are kept (they may move).
 */
async function shrink(asset: ImagePicker.ImagePickerAsset, name: string): Promise<{ uri: string; name: string }> {
  if (/\.gif$/i.test(name)) return { uri: asset.uri, name }
  const longest = Math.max(asset.width, asset.height)
  const context = ImageManipulator.manipulate(asset.uri)
  if (longest > PHOTO_MAX_PX) {
    context.resize(asset.width >= asset.height ? { width: PHOTO_MAX_PX } : { height: PHOTO_MAX_PX })
  }
  const image = await context.renderAsync()
  const saved = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG })
  return { uri: saved.uri, name: name.replace(/\.[^.]+$/, '') + '.jpg' }
}

/** Picked files, or the problems that kept some out (wrong kind, too big). */
export interface Picked {
  added: PendingMedia[]
  problems: string[]
}

async function check(uri: string, name: string, isImage: boolean, picked: Picked) {
  const problem = mediaProblem(name, new File(uri).size ?? 0)
  if (problem) picked.problems.push(problem)
  else picked.added.push({ key: newKey(), uri, name, isImage })
}

/** Samsung's camera app - opened like its home-screen icon, so it starts on the back lens. */
const SAMSUNG_CAMERA = 'com.sec.android.app.camera'

/**
 * Opens the camera app as if from the home screen. Samsung's camera started
 * on the selfie lens even for the "open the camera" request (user's S25 Ultra),
 * so it's started through its launcher entry; other phones get the request.
 */
async function openCameraApp(): Promise<boolean> {
  try {
    IntentLauncher.openApplication(SAMSUNG_CAMERA) // its launcher entry (needs <queries>, plugins/withCameraAppQuery)
    return true
  } catch {
    // not a Samsung phone
  }
  try {
    await Linking.sendIntent('android.media.action.STILL_IMAGE_CAMERA')
    return true
  } catch {
    return false
  }
}

/** Resolves when the app comes back to the front after having left it. */
function backInApp(): Promise<void> {
  return new Promise((resolve) => {
    let left = false
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') left = true
      else if (left) {
        sub.remove()
        resolve()
      }
    })
  })
}

/**
 * Take photo on Android (user's call, 2026-10-09): the phone's full camera app,
 * opened like from the home screen - Samsung's camera, asked for a photo by
 * another app, always started on the selfie lens whatever it was told. Back
 * in AI Planner, the photos taken meanwhile are added. Null: none taken, the
 * camera couldn't open, or reading photos isn't allowed.
 */
async function photosFromCameraApp(): Promise<Picked | null> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo'])
  // "Selected photos only" can't see a new photo - say so instead of silently adding nothing.
  if (!permission.granted || permission.accessPrivileges === 'limited') {
    return { added: [], problems: [t('media.needPhotoAccess')] }
  }
  const since = Date.now() - 5000
  const back = backInApp()
  if (!(await openCameraApp())) return null
  await back
  // By when the file was saved, not "date taken": some phones store that shifted by
  // the time zone, which made a new photo look older than the camera opening.
  const recent = async () =>
    (
      await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
        first: 20,
      })
    ).assets.filter((a) => a.modificationTime >= since || a.creationTime >= since)
  let assets = await recent()
  if (assets.length === 0) {
    // The last photo can reach the phone's photo list a moment after we're back.
    await new Promise((r) => setTimeout(r, 1500))
    assets = await recent()
  }
  if (assets.length === 0) return { added: [], problems: [t('media.noNewPhotos')] }
  const picked: Picked = { added: [], problems: [] }
  for (const asset of assets.reverse()) {
    const info = await MediaLibrary.getAssetInfoAsync(asset)
    const uri = info.localUri ?? asset.uri
    const photo = await shrink({ uri, width: asset.width, height: asset.height } as ImagePicker.ImagePickerAsset, photoName(new Date(asset.creationTime)))
    await check(photo.uri, photo.name, true, picked)
  }
  return picked
}

/** Take a photo with the camera, or choose pictures from the gallery. Null: cancelled or not allowed. */
export async function pickPhotos(camera: boolean): Promise<Picked | null> {
  if (camera && Platform.OS === 'android') return photosFromCameraApp()
  const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true }
  if (!permission.granted) return null
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false }
  const result = camera
    ? // The phone's camera app, asked for the back lens - photos of things (a flyer, a receipt), not selfies.
      // patches/expo-image-picker adds the vendor-specific ways of asking (Samsung, LG...).
      await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.back })
    : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 10 })
  if (result.canceled) return null
  const picked: Picked = { added: [], problems: [] }
  for (const asset of result.assets) {
    // Android's photo picker hands out random ids as names ("99fef59a-....jpg"): use the date then.
    const meaningless = !asset.fileName || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(asset.fileName)
    const original = camera || meaningless ? photoName() : asset.fileName!
    const photo = await shrink(asset, original)
    await check(photo.uri, photo.name, true, picked)
  }
  return picked
}

/** Choose documents (PDF, Office, text). Null: cancelled. */
export async function pickDocuments(): Promise<Picked | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME, multiple: true, copyToCacheDirectory: true })
  if (result.canceled) return null
  const picked: Picked = { added: [], problems: [] }
  for (const asset of result.assets) await check(asset.uri, asset.name, isImageName(asset.name), picked)
  return picked
}

/**
 * Opens a stored document: downloads it (with the sign-in) and hands it to
 * the system's share sheet - "Open with" another app, save, or send.
 */
export async function openAttachment(a: Attachment) {
  // A folder per attachment, so the file keeps its own name in the other app.
  const folder = new Directory(Paths.cache, 'attachments', a.id)
  folder.create({ intermediates: true, idempotent: true })
  const target = new File(folder, a.fileName)
  if (!target.exists) {
    await File.downloadFileAsync(`${API_URL}/api/attachments/${a.id}/content`, target, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
  }
  await Sharing.shareAsync(target.uri, { mimeType: a.contentType, dialogTitle: a.fileName })
}

/**
 * Save's media step: removals first, then uploads one by one. Each finished
 * upload leaves the pending list, so a failure part-way keeps only what's
 * still to do (Save again retries just that). Same as the web's.
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
    // An expo-file-system File is a Blob - Expo's fetch rejects RN's { uri, name, type } parts.
    form.append('file', new File(p.uri), p.name)
    try {
      await api.attachments.upload(target.itemType, target.id, form)
    } catch (err) {
      throw new Error(t('media.uploadFailed', { name: p.name, error: err instanceof Error ? err.message : String(err) }))
    }
    done.uploaded(p.key)
  }
}
