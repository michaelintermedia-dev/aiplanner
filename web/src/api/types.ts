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
