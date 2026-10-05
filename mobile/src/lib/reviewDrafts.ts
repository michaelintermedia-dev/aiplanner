import type { ItemDraft } from '@shared/captureDraft'
import { File, Paths } from 'expo-file-system'

/**
 * Edits made in a capture review, kept on the device until Save / Cancel -
 * if the app is closed mid-review, Resume brings them back (restoreDrafts
 * checks they still fit). One small JSON file of { captureId: drafts }.
 */
/** One small JSON file of { key: value }, read and written whole. */
function draftStore<T>(fileName: string) {
  const file = () => new File(Paths.document, fileName)
  const readAll = (): Record<string, unknown> => {
    try {
      const f = file()
      return f.exists ? (JSON.parse(f.textSync()) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  const writeAll = (all: Record<string, unknown>) => {
    try {
      const f = file()
      if (!f.exists) f.create()
      f.write(JSON.stringify(all))
    } catch {
      // not kept
    }
  }
  return {
    load: (key: string): unknown => readAll()[key] ?? null,
    save(key: string, value: T) {
      writeAll({ ...readAll(), [key]: value })
    },
    clear(key: string) {
      const all = readAll()
      if (!(key in all)) return
      delete all[key]
      writeAll(all)
    },
  }
}

export const reviewDrafts = draftStore<ItemDraft[]>('review-drafts.json')

/** The item Edit page's unsaved changes, by item id (ItemEditor checks they still fit). */
export const editDrafts = draftStore<unknown>('item-edit-drafts.json')
