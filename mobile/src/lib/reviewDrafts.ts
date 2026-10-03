import type { ItemDraft } from '@shared/captureDraft'
import { File, Paths } from 'expo-file-system'

/**
 * Edits made in a capture review, kept on the device until Save / Cancel -
 * if the app is closed mid-review, Resume brings them back (restoreDrafts
 * checks they still fit). One small JSON file of { captureId: drafts }.
 */
const file = () => new File(Paths.document, 'review-drafts.json')

function readAll(): Record<string, unknown> {
  try {
    const f = file()
    return f.exists ? (JSON.parse(f.textSync()) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, unknown>) {
  try {
    const f = file()
    if (!f.exists) f.create()
    f.write(JSON.stringify(all))
  } catch {
    // not kept
  }
}

export const reviewDrafts = {
  load: (captureId: string): unknown => readAll()[captureId] ?? null,
  save(captureId: string, drafts: ItemDraft[]) {
    writeAll({ ...readAll(), [captureId]: drafts })
  },
  clear(captureId: string) {
    const all = readAll()
    if (!(captureId in all)) return
    delete all[captureId]
    writeAll(all)
  },
}
