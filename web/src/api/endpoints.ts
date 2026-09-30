import { request } from './client'
import type {
  Appointment,
  AuthResponse,
  CalendarRange,
  CalendarView,
  CreateAppointmentRequest,
  SaveTaskRequest,
  Task,
  Today,
  User,
} from './types'

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { email, password }, { anonymous: true }),
  register: (email: string, password: string, displayName: string, timeZoneId: string) =>
    request<AuthResponse>('POST', '/auth/register', { email, password, displayName, timeZoneId }, { anonymous: true }),
  logout: (refreshToken: string) => request<void>('POST', '/auth/logout', { refreshToken }),
  me: () => request<User>('GET', '/users/me'),
}

export const tasksApi = {
  list: (includeCompleted = false) => request<Task[]>('GET', `/tasks?includeCompleted=${includeCompleted}`),
  create: (task: SaveTaskRequest) => request<Task>('POST', '/tasks', task),
  update: (id: string, task: SaveTaskRequest) => request<Task>('PUT', `/tasks/${id}`, task),
  complete: (id: string) => request<Task>('PATCH', `/tasks/${id}/complete`),
  cancel: (id: string) => request<Task>('PATCH', `/tasks/${id}/cancel`),
  reopen: (id: string) => request<Task>('PATCH', `/tasks/${id}/reopen`),
  remove: (id: string) => request<void>('DELETE', `/tasks/${id}`),
}

export const appointmentsApi = {
  create: (appointment: CreateAppointmentRequest) => request<Appointment>('POST', '/appointments', appointment),
  complete: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/complete`),
  cancel: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/cancel`),
  remove: (id: string) => request<void>('DELETE', `/appointments/${id}`),
}

export const todayApi = {
  get: () => request<Today>('GET', '/today'),
}

export const calendarApi = {
  get: (view: CalendarView, date: string) => request<CalendarRange>('GET', `/calendar?view=${view}&date=${date}`),
}
