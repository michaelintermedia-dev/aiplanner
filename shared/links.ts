// Links in what people write, and places opened in map apps (user's request,
// 2026-10-12). Dependency-free: used by the web and the app.

export type TextPart = { text: string; url?: undefined } | { text: string; url: string }

// http(s)://... or www.... up to whitespace; trailing punctuation is not part of the link.
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi
const TRAILING = /[.,;:!?)\]}'"»”’]+$/

/** Text cut into plain parts and links (a "www." link gets https://), in order. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    let raw = m[0]
    const trail = raw.match(TRAILING)?.[0] ?? ''
    // Keep a closing bracket that has its opening one inside the link (Wikipedia-style URLs).
    if (trail.startsWith(')') && raw.includes('(')) raw = raw.slice(0, raw.length - trail.length + 1).replace(/[.,;:!?'"]+$/, '')
    else raw = raw.slice(0, raw.length - trail.length)
    if (!raw) continue
    const start = m.index!
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: raw, url: /^www\./i.test(raw) ? `https://${raw}` : raw })
    last = start + raw.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export const hasLink = (text: string | null | undefined) => !!text && linkify(text).some((p) => p.url)

/** "32.0853, 34.7818" (or with a space only) -> coordinates; else null. */
export function coordinates(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** Coordinates inside a map link (".../@32.08,34.78,15z", "?q=32.08,34.78", "ll=..."), if any. */
function coordinatesInLink(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? url.match(/[?&](?:q|query|ll|daddr|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
  return m ? coordinates(`${m[1]},${m[2]}`) : null
}

export interface PlaceLinks {
  /** What to show: the place as written, or "map link" for a bare URL (label is the client's). */
  isLink: boolean
  google: string
  /** null when Waze can't find it (a map link without coordinates). */
  waze: string | null
  apple: string
}

/** Where a place opens in Google Maps, Waze and Apple Maps. */
export function placeLinks(place: string): PlaceLinks {
  const text = place.trim()
  const link = /^https?:\/\//i.test(text) ? text : null
  const point = link ? coordinatesInLink(link) : coordinates(text)
  const q = encodeURIComponent(text)
  const at = point ? `${point.lat},${point.lng}` : null
  return {
    isLink: !!link,
    google: link ?? `https://www.google.com/maps/search/?api=1&query=${at ?? q}`,
    waze: at ? `https://waze.com/ul?ll=${at}&navigate=yes` : link ? null : `https://waze.com/ul?q=${q}&navigate=yes`,
    apple: at ? `https://maps.apple.com/?ll=${at}&q=${at}` : `https://maps.apple.com/?q=${link ? encodeURIComponent(link) : q}`,
  }
}

/** A position as the place text: "32.08530, 34.78180" (5 decimals ~ 1 m). */
export const placeFromPosition = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`
