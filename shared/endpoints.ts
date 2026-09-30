import type {
  Appointment,
  AuthResponse,
  CalendarRange,
  CalendarView,
  Capture,
  CaptureSummary,
  ConfirmCaptureItem,
  CreateAppointmentRequest,
  SaveTaskRequest,
  Task,
  Today,
  User,
} from './types'

/**
 * The HTTP function each client provides: it owns the base URL, token
 * attachment and refresh. `path` is relative to /api, e.g. "/tasks". A
 * FormData body is sent as multipart; anything else as JSON.
 */
export type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { anonymous?: boolean },
) => Promise<T>

/** Typed API endpoints shared by the web and mobile clients. */
export function createApi(request: RequestFn) {
  return {
    auth: {
      login: (email: string, password: string) =>
        request<AuthResponse>('POST', '/auth/login', { email, password }, { anonymous: true }),
      register: (email: string, password: string, displayName: string, timeZoneId: string) =>
        request<AuthResponse>(
          'POST',
          '/auth/register',
          { email, password, displayName, timeZoneId },
          { anonymous: true },
        ),
      logout: (refreshToken: string) => request<void>('POST', '/auth/logout', { refreshToken }),
      me: () => request<User>('GET', '/users/me'),
    },
    tasks: {
      list: (includeCompleted = false) => request<Task[]>('GET', `/tasks?includeCompleted=${includeCompleted}`),
      create: (task: SaveTaskRequest) => request<Task>('POST', '/tasks', task),
      update: (id: string, task: SaveTaskRequest) => request<Task>('PUT', `/tasks/${id}`, task),
      complete: (id: string) => request<Task>('PATCH', `/tasks/${id}/complete`),
      cancel: (id: string) => request<Task>('PATCH', `/tasks/${id}/cancel`),
      reopen: (id: string) => request<Task>('PATCH', `/tasks/${id}/reopen`),
      remove: (id: string) => request<void>('DELETE', `/tasks/${id}`),
    },
    appointments: {
      create: (appointment: CreateAppointmentRequest) => request<Appointment>('POST', '/appointments', appointment),
      complete: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/complete`),
      cancel: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/cancel`),
      remove: (id: string) => request<void>('DELETE', `/appointments/${id}`),
    },
    today: {
      get: () => request<Today>('GET', '/today'),
    },
    calendar: {
      get: (view: CalendarView, date: string) =>
        request<CalendarRange>('GET', `/calendar?view=${view}&date=${date}`),
    },
    captures: {
      /** Analyze typed text. Nothing is saved as a task/appointment until confirm(). */
      text: (text: string) => request<Capture>('POST', '/captures/text', { text }),
      /** Upload a recording: a FormData with the file in field "audio". */
      voice: (form: FormData) => request<Capture>('POST', '/captures/voice', form),
      list: (take = 50) => request<CaptureSummary[]>('GET', `/captures?take=${take}`),
      get: (id: string) => request<Capture>('GET', `/captures/${id}`),
      confirm: (id: string, items: ConfirmCaptureItem[]) =>
        request<Capture>('POST', `/captures/${id}/confirm`, { items }),
      deleteAudio: (id: string) => request<void>('DELETE', `/captures/${id}/audio`),
    },
  }
}
