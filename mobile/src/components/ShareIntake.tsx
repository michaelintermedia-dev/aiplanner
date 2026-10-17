import { isImageName } from '@shared/media'
import { useShareIntentContext } from 'expo-share-intent'
import { useEffect } from 'react'
import { prepareSharedFiles } from '@/lib/media'
import { offerShared } from '@/lib/sharedIn'

/**
 * Takes what another app shared into Gatazee (Android share sheet; user's
 * request, 2026-10-12) and hands it to the floating toolbar (lib/sharedIn),
 * which saves it as a new entry. Mounted only when signed in - a share that
 * arrives before sign-in waits in ShareIntentProvider until then.
 */
export function ShareIntake() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()

  useEffect(() => {
    if (!hasShareIntent) return
    const text = (shareIntent.text ?? shareIntent.webUrl ?? '').trim()
    const title = shareIntent.meta?.title?.trim()
    // The sending app's title (a page or video name) helps the AI when the text is only a link.
    const words = title && !text.includes(title) ? `${title}
${text}` : text
    const files = (shareIntent.files ?? []).map((f, i) => {
      const name = f.fileName || `shared-${i + 1}${f.mimeType?.startsWith('image/') ? '.jpg' : ''}`
      return { uri: f.path, name, isImage: !!f.mimeType?.startsWith('image/') || isImageName(name), width: f.width, height: f.height }
    })
    resetShareIntent()
    void prepareSharedFiles(files)
      .catch(() => ({ added: [], problems: [] }))
      .then((picked) => {
        if (words || picked.added.length > 0) offerShared(words, picked.added)
      })
  }, [hasShareIntent, shareIntent, resetShareIntent])

  return null
}
