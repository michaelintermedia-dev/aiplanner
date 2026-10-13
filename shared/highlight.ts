/**
 * Search words marked in a feed row (filters strategy, 2026-10-13): the words
 * as the server matches them (lower case, each on its own), found anywhere in
 * the text regardless of case.
 */
export const searchWords = (text: string): string[] =>
  [...new Set(text.toLowerCase().split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 0))]

export interface HighlightPart {
  text: string
  hit: boolean
}

export function highlight(text: string, words: string[]): HighlightPart[] {
  if (!words.length || !text) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const marks = new Array<boolean>(text.length).fill(false)
  for (const w of words) {
    for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + w.length)) marks.fill(true, i, i + w.length)
  }
  const parts: HighlightPart[] = []
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.hit === marks[i]) last.text += text[i]
    else parts.push({ text: text[i], hit: marks[i] })
  }
  return parts
}
