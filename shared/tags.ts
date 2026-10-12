/**
 * Tags on any item (user's request, 2026-10-08): the user's own list, matched
 * case-insensitively ("shopping" = "Shopping"). The pickers show that list as
 * chips to tap (several at once) plus a box for a new one; the server adds a
 * new name to the list when the item is saved. Same rules as the server's TagSync.
 */

export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 50

export const sameTag = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase()

export const hasTag = (tags: readonly string[], name: string) => tags.some((x) => sameTag(x, name))

/** Turns a tag on or off. */
export const toggleTag = (tags: readonly string[], name: string): string[] =>
  hasTag(tags, name) ? tags.filter((x) => !sameTag(x, name)) : [...tags, name]

/**
 * Adds what was typed in the "new tag" box: commas split it into several, a
 * leading # is dropped, and a name already in the user's list keeps that spelling.
 */
export function addTypedTags(tags: readonly string[], typed: string, known: readonly string[] = []): string[] {
  const next = [...tags]
  for (const part of typed.split(',')) {
    let name = part.trim().replace(/^#+/, '').trim().slice(0, MAX_TAG_LENGTH).trim()
    if (!name) continue
    name = known.find((k) => sameTag(k, name)) ?? name
    if (!hasTag(next, name) && next.length < MAX_TAGS) next.push(name)
  }
  return next
}

/** How many suggestions the pickers show at once (the rest behind "All tags"). */
export const SUGGESTIONS = 6

/**
 * What the "Add a tag" box offers (user's call, 2026-10-12 - the old picker
 * showed every tag ever used): nothing typed - the most used tags not on the
 * item yet; something typed - the tags containing it, those starting with it
 * first (the server's order - most used - within each group).
 */
export function tagSuggestions(known: readonly string[], selected: readonly string[], typed: string, limit = SUGGESTIONS): string[] {
  const q = typed.trim().replace(/^#+/, '').trim().toLocaleLowerCase()
  const free = known.filter((k) => !hasTag(selected, k))
  if (!q) return free.slice(0, limit)
  const starts = free.filter((k) => k.toLocaleLowerCase().startsWith(q))
  const contains = free.filter((k) => !k.toLocaleLowerCase().startsWith(q) && k.toLocaleLowerCase().includes(q))
  return [...starts, ...contains].slice(0, limit)
}

/** The typed name as a new tag, when it isn't one of the user's tags or the item's already ("Create “x”"). */
export function newTagName(known: readonly string[], selected: readonly string[], typed: string): string | null {
  const name = typed.trim().replace(/^#+/, '').trim().slice(0, MAX_TAG_LENGTH).trim()
  if (!name || name.includes(',') || hasTag(known, name) || hasTag(selected, name)) return null
  return name
}

/**
 * The chips to offer: the user's tags (most used first, as the server sends
 * them) plus any on the item that aren't in that list yet (new, unsaved).
 */
export const tagChoices = (known: readonly string[], selected: readonly string[]): string[] => [
  ...known,
  ...selected.filter((s) => !hasTag(known, s)),
]
