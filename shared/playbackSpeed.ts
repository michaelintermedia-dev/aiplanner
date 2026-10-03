/**
 * Playback speed for recordings (web + mobile). The choice is remembered per
 * device and applies to every player. 2x is the most phones allow.
 */
export const SPEEDS = [1, 1.5, 2] as const
export type Speed = (typeof SPEEDS)[number]

export const SPEED_KEY = 'playbackSpeed'

export const speedLabel = (s: number) => `${s}×`

/** A saved value back to a speed (anything else -> 1×). */
export const parseSpeed = (value: string | null | undefined): Speed => {
  const n = Number(value)
  return (SPEEDS as readonly number[]).includes(n) ? (n as Speed) : 1
}
