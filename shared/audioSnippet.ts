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

/** The snippet of the saved item `item` in `capture`, or null (typed capture, unknown, or audio deleted). */
export function itemSnippet(capture: Capture, item: AppendTarget | undefined): Snippet | null {
  if (!item || capture.audioParts === 0) return null
  const source = capture.items.find((i) =>
    item.itemType === 'Task' ? i.resultingTaskId === item.itemId : item.itemType === 'Appointment' ? i.resultingAppointmentId === item.itemId : i.resultingNoteId === item.itemId,
  )
  if (source?.audioStartMs == null || source.audioEndMs == null || source.audioEndMs <= source.audioStartMs) return null
  return { startMs: source.audioStartMs, endMs: source.audioEndMs }
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
