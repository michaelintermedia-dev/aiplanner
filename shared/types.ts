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
  reminderMinutesBeforeDue?: number | null
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
}

export interface CreateAppointmentRequest {
  title: string
  description?: string | null
  notes?: string | null
  startUtc: string
  endUtc: string
  location?: string | null
  participantNames?: string[] | null
  reminderMinutesBeforeStart?: number | null
}

export interface UpcomingReminder {
  reminderId: string
  triggerAtUtc: string
  title: string
  sourceType: 'Task' | 'Appointment'
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

/** A proposed item. StartUtc/EndUtc for appointments; DueUtc for tasks and reminders. */
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
  reminderMinutesBefore: number | null
  recurrence: RecurrenceFrequency | null
  /** A question the user should look at before saving. */
  clarification: string | null
  confidence: number | null
  resultingTaskId: string | null
  resultingAppointmentId: string | null
  resultingNoteId: string | null
}

export interface Capture {
  id: string
  source: 'Text' | 'Voice'
  title: string
  summary: string | null
  /** The original words: typed text or the full transcript. Never replaced by the summary. */
  inputText: string
  languageCode: string | null
  hasAudio: boolean
  createdAtUtc: string
  items: CaptureItem[]
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
  reminderMinutesBefore: number | null
}
