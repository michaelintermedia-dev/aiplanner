import { File, Paths } from 'expo-file-system'

/**
 * One-time tickets for the "Quick recording" widget (bug fix, 2026-10-17).
 * Android remembers the link that started the app. After the widget opened it,
 * leaving with Back and later tapping the app icon could bring the app back
 * from that same link (aiplanner://record) - and it started recording again.
 * So every widget link carries a ticket (?t=...): the first use records, a
 * replayed one only opens the app, and the widget gets a new ticket each time.
 * Kept in a file: the widget is drawn without the app running.
 */
interface Tickets {
  /** The ticket the widget hands out now. */
  next: string
  /** Tickets already used (the last few). */
  used: string[]
}

const ticketFile = () => new File(Paths.document, 'quick-record.json')
const newTicket = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function load(): Tickets | null {
  try {
    const f = ticketFile()
    return f.exists ? (JSON.parse(f.textSync()) as Tickets) : null
  } catch {
    return null
  }
}

function save(tickets: Tickets) {
  try {
    const f = ticketFile()
    if (!f.exists) f.create()
    f.write(JSON.stringify(tickets))
  } catch {
    // not kept: the widget keeps its current ticket and still works
  }
}

/** The ticket for the widget's link (made on first use). */
export function widgetTicket(): string {
  const stored = load()
  if (stored) return stored.next
  const fresh = { next: newTicket(), used: [] }
  save(fresh)
  return fresh.next
}

/**
 * True for a real tap on the widget, false for Android replaying an old link.
 * A link without a ticket (a widget drawn by an older version) goes through.
 */
export function claimTicket(ticket: string | undefined): boolean {
  if (!ticket) return true
  const stored = load() ?? { next: newTicket(), used: [] }
  if (stored.used.includes(ticket)) return false
  save({ next: stored.next === ticket ? newTicket() : stored.next, used: [...stored.used, ticket].slice(-20) })
  return true
}
