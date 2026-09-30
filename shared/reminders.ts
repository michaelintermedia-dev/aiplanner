/** Reminder choices in minutes before the item (null = none). */
export const REMINDER_CHOICES: (number | null)[] = [null, 0, 10, 30, 60, 120, 1440]

export function reminderLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'No reminder'
  if (minutes === 0) return 'At the time'
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`
  return `${minutes} min before`
}

/** The standard choices plus the current value if it's something else (e.g. 15). */
export function reminderChoicesWith(current: number | null | undefined): (number | null)[] {
  return current === null || current === undefined || REMINDER_CHOICES.includes(current)
    ? REMINDER_CHOICES
    : [...REMINDER_CHOICES, current].sort((a, b) => (a ?? -1) - (b ?? -1))
}
