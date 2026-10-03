import { t } from './i18n'
import type { AppendTarget, Capture } from './types'

/**
 * Each item from a voice capture knows where in the recording it was said
 * (CaptureItem.audioStartMs/audioEndMs, on one timeline with the parts back to
 * back), so its page can play just that part. Shared by web and mobile.
 */
export interface Snippet {
  startMs: number
  endMs: number
}

/**
 * Everything said about the saved item `item` in `capture`, in order: the
 * words it came from plus anything spoken when adding to it later (typed
 * additions have no audio and are skipped). Overlapping pieces are merged.
 * Empty = nothing to play (typed capture, unknown, or audio deleted).
 */
export function itemClips(capture: Capture, item: AppendTarget | undefined): Snippet[] {
  if (!item || capture.audioParts === 0) return []
  const clips = capture.items
    .filter((i) =>
      item.itemType === 'Task' ? i.resultingTaskId === item.itemId : item.itemType === 'Appointment' ? i.resultingAppointmentId === item.itemId : i.resultingNoteId === item.itemId,
    )
    .filter((i) => i.audioStartMs != null && i.audioEndMs != null && i.audioEndMs > i.audioStartMs)
    .map((i) => ({ startMs: i.audioStartMs!, endMs: i.audioEndMs! }))
    .sort((a, b) => a.startMs - b.startMs)
  const merged: Snippet[] = []
  for (const c of clips) {
    const last = merged[merged.length - 1]
    if (last && c.startMs <= last.endMs) last.endMs = Math.max(last.endMs, c.endMs)
    else merged.push({ ...c })
  }
  return merged
}

/** "Play this part (0:02–0:05)", or "Play its 2 parts (0:08)" when it was said in pieces. */
export function clipsLabel(clips: Snippet[]): string {
  if (clips.length === 1) return t('player.playThisPart', { from: clipTime(clips[0].startMs), to: clipTime(clips[0].endMs) })
  const length = clips.reduce((sum, c) => sum + c.endMs - c.startMs, 0)
  return t('player.playItsParts', { count: clips.length, length: clipTime(length) })
}

/** Which part a moment on the whole-recording timeline falls in, and where in that part. */
export function locateInParts(durationsMs: number[], ms: number): { part: number; offsetMs: number } {
  let start = 0
  for (let part = 0; part < durationsMs.length; part++) {
    if (ms < start + durationsMs[part] || part === durationsMs.length - 1) return { part, offsetMs: Math.max(0, ms - start) }
    start += durationsMs[part]
  }
  return { part: 0, offsetMs: ms }
}

/** Where each part starts on the whole-recording timeline. */
export const partStartsMs = (durationsMs: number[]) => durationsMs.map((_, i) => durationsMs.slice(0, i).reduce((a, b) => a + b, 0))

/** 12345 -> "0:12". */
export const clipTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
