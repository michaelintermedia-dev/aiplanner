// API contracts, mirroring the DTOs in backend/src/AiPlanner.Application.
// All DateTime values are ISO-8601 UTC strings (ending in "Z").

export type TaskStatus = 'Inbox' | 'Planned' | 'InProgress' | 'Ongoing' | 'Completed' | 'Cancelled'
export type TaskPriority = 'None' | 'Low' | 'Medium' | 'High'
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled'

export interface AuthResponse {
  userId: string
  email: string
  displayName: string
  accessToken: string
  accessTokenExpiresAtUtc: string
  refreshToken: string
}

export interface User {
  id: string
  email: string
  displayName: string
  timeZoneId: string
  locale: string
  createdAtUtc: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  notes: string | null
  aiSummary: string | null
  startDateUtc: string | null
  dueDateUtc: string | null
  hasDueTime: boolean
  status: TaskStatus
  priority: TaskPriority
  completedAtUtc: string | null
  tags: string[]
  createdAtUtc: string
  updatedAtUtc: string
  /** Only on single-item reads (tasks.get); null in lists. */
  /** Filled on single-item reads (detail view). */
  reminders?: Reminder[]
  /** The capture this task came from (transcript/recording). */
  sourceCaptureId?: string | null
}

export interface SaveTaskRequest {
  title: string
  description?: string | null
  notes?: string | null
  startDateUtc?: string | null
  dueDateUtc?: string | null
  hasDueTime?: boolean
  priority?: TaskPriority
  isOngoing?: boolean
  reminders?: Reminder[]
  tags?: string[] | null
}

export interface Appointment {
  id: string
  title: string
  description: string | null
  notes: string | null
  aiSummary: string | null
  startUtc: string
  endUtc: string
  location: string | null
  status: AppointmentStatus
  participants: { name: string; email: string | null }[]
  createdAtUtc: string
  updatedAtUtc: string
  /** Only on single-item reads (appointments.get); null in lists. */
  /** Filled on single-item reads (detail view). */
  reminders?: Reminder[]
  /** The capture this appointment came from (transcript/recording). */
  sourceCaptureId?: string | null
}

/** Also the PUT body: an update replaces all fields. */
export interface CreateAppointmentRequest {
  title: string
  description?: string | null
  notes?: string | null
  startUtc: string
  endUtc: string
  location?: string | null
  participantNames?: string[] | null
  reminders?: Reminder[]
}

// ---- Unified feed ------------------------------------------------------------

/** "Appointment" is shown to users as "Event". */
export type FeedKind = 'Task' | 'Appointment' | 'Note'
export type FeedSort = 'CreatedDesc' | 'CreatedAsc' | 'UpdatedDesc' | 'DateAsc' | 'PriorityHigh'

export interface FeedItem {
  /** When its next reminder goes off (null/absent = none coming). */
  nextReminderUtc?: string | null
  /** That reminder repeats (daily / weekdays / weekly). */
  reminderRepeats?: boolean
  id: string
  kind: FeedKind
  title: string
  /** Note text, or a task/appointment description. */
  snippet: string | null
  /** Task/appointment status; null for notes. */
  status: string | null
  /** Task due date or appointment start. */
  dateUtc: string | null
  endUtc: string | null
  hasTime: boolean
  priority: TaskPriority | null
  location: string | null
  tags: string[]
  /** Created by the AI from a capture. */
  fromCapture: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export interface FeedPage {
  items: FeedItem[]
  /** Pass back to get the next page; null at the end. */
  nextCursor: string | null
}

/** Information to keep, with nothing to do - optionally with a reminder. */
export interface Note {
  id: string
  title: string | null
  content: string
  aiSummary: string | null
  /** The capture this note came from (transcript/recording). */
  sourceCaptureId: string | null
  reminders: Reminder[]
  createdAtUtc: string
  updatedAtUtc: string
}

export interface SaveNoteRequest {
  title?: string | null
  content: string
  /** Omitted or empty = no reminders (PUT replaces them). */
  reminders?: Reminder[]
}

export interface UpcomingReminder {
  /** Same key as the matching notification. */
  key: string
  triggerAtUtc: string
  title: string
  sourceType: ItemType
  sourceId: string
}

export interface Today {
  date: string // yyyy-MM-dd in the user's timezone
  appointmentsToday: Appointment[]
  tasksDueToday: Task[]
  ongoingTasks: Task[]
  overdueTasks: Task[]
  upcomingReminders: UpcomingReminder[]
}

export interface CalendarItem {
  id: string
  itemType: 'Task' | 'Appointment'
  title: string
  startUtc: string
  endUtc: string | null
  hasTime: boolean
  status: string
  priority: string | null
  location: string | null
}

export interface CalendarRange {
  fromUtc: string
  toUtc: string
  items: CalendarItem[]
  ongoingTasks: Task[]
}

export type CalendarView = 'day' | 'week' | 'month'

// ---- Captures (AI quick capture, spec sections 14-21) ----------------------

export type ExtractionIntent = 'Task' | 'Appointment' | 'Reminder' | 'Note'
export type ExtractionStatus = 'PendingReview' | 'Accepted' | 'Edited' | 'Rejected'
export type RecurrenceFrequency = 'Daily' | 'Weekdays' | 'Weekly' | 'Monthly' | 'Custom'

/** A proposed item. StartUtc/EndUtc for appointments; DueUtc for tasks. Any can carry reminders. */
export interface CaptureItem {
  id: string
  intent: ExtractionIntent
  status: ExtractionStatus
  title: string
  summary: string | null
  description: string | null
  startUtc: string | null
  endUtc: string | null
  dueUtc: string | null
  hasTime: boolean
  location: string | null
  priority: TaskPriority | null
  reminders: Reminder[]
  recurrence: RecurrenceFrequency | null
  /** A question the user should look at before saving. */
  clarification: string | null
  confidence: number | null
  resultingTaskId: string | null
  resultingAppointmentId: string | null
  resultingNoteId: string | null
  /** From continuing a capture: completes the item the user continued from. */
  addsToCurrent: boolean
  /** Where in the recording this item was said (ms on the whole-recording timeline), if known. */
  audioStartMs?: number | null
  audioEndMs?: number | null
}

export interface Capture {
  id: string
  source: 'Text' | 'Voice'
  title: string
  summary: string | null
  /** The original words: typed text or the full transcript. Never replaced by the summary. */
  inputText: string
  languageCode: string | null
  /** Playable recording segments (0 = text capture, or recording deleted). */
  audioParts: number
  createdAtUtc: string
  items: CaptureItem[]
  /** Length of each recording part, in order - places item snippets across parts. */
  audioPartDurationsMs?: number[] | null
}

export interface CaptureSummary {
  id: string
  source: 'Text' | 'Voice'
  title: string
  summary: string | null
  createdAtUtc: string
  itemCount: number
  pendingCount: number
}

/** One reviewed item sent to /confirm: include=false rejects it. */
/** Settings - Recordings. */
export interface RecordingSettings {
  /** Cut pauses longer than a second out of saved recordings. */
  shortenPauses: boolean
}

export interface ConfirmCaptureItem {
  id: string
  include: boolean
  intent: ExtractionIntent
  title: string
  description: string | null
  startUtc: string | null
  endUtc: string | null
  dueUtc: string | null
  hasTime: boolean
  location: string | null
  priority: TaskPriority | null
  reminders: Reminder[]
  /** Set to add this item's text to an existing item instead of creating one. */
  appendToType?: ItemType | null
  appendToId?: string | null
  /** The fields are the whole item after the addition: update it in place (title and created date kept). */
  replacesItem?: boolean
}

/** The saved item a capture is continued from ("Add to this task"). */
export interface AppendTarget {
  itemType: ItemType
  itemId: string
  title: string
}

export type ReminderKind = 'At' | 'Before' | 'Daily' | 'Weekdays' | 'Weekly'
export type Weekday = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

/**
 * A reminder on any item - the same shape everywhere. Which fields matter
 * depends on kind: At - atUtc; Before - minutesBefore (moves with the item);
 * Daily/Weekdays - time; Weekly - time + days. Repeating ones stay on until
 * turned off. nextAtUtc is output only.
 */
export interface Reminder {
  kind: ReminderKind
  atUtc?: string | null
  minutesBefore?: number | null
  /** "HH:mm" in the user's timezone. */
  time?: string | null
  days?: Weekday[] | null
  nextAtUtc?: string | null
}

export type ItemType = 'Task' | 'Appointment' | 'Note'

/**
 * One notification to show at atUtc (Phase 4). The backend decides what goes
 * off when; clients schedule these locally. The key is stable per occurrence.
 */
export interface UpcomingNotification {
  key: string
  kind: 'Reminder' | 'Snoozed' | 'DailySummary'
  atUtc: string
  title: string
  body: string | null
  /** Null for the daily summary. */
  itemType: ItemType | null
  itemId: string | null
  /** An open task: offer a "Done" action. */
  canComplete: boolean
}

export interface SnoozeRequest {
  itemType: ItemType
  itemId: string
  title: string
  body: string | null
  minutes: number
}

export interface NotificationSettings {
  enabled: boolean
  taskReminders: boolean
  appointmentReminders: boolean
  dailySummary: boolean
  /** "HH:mm", the user's local time. */
  dailySummaryTime: string
}

/** Change an item's type (POST /items/convert). Dates override what's carried over. */
export interface ConvertItemRequest {
  fromType: ItemType
  id: string
  toType: ItemType
  startUtc?: string | null
  endUtc?: string | null
  dueUtc?: string | null
  hasDueTime?: boolean | null
}

/** Points at one item of any type. */
export interface ItemRef {
  itemType: ItemType
  id: string
}

/** How many of the selected items an operation changed. */
export interface ItemsResult {
  count: number
}

/** The new item. needsDetails: something had to be guessed (an event's time) - open it for editing. */
export interface ConvertedItem {
  itemType: ItemType
  id: string
  needsDetails: boolean
}
