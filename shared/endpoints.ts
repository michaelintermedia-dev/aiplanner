import type {
  Appointment,
  AuthResponse,
  CalendarRange,
  CalendarView,
  Capture,
  CaptureSummary,
  ConfirmCaptureItem,
  CreateAppointmentRequest,
  FeedKind,
  FeedPage,
  FeedSort,
  Note,
  SaveNoteRequest,
  SaveTaskRequest,
  Task,
  Today,
  User,
} from './types'

/**
 * The HTTP function each client provides: it owns the base URL, token
 * attachment and refresh. `path` is relative to /api, e.g. "/tasks". A
 * FormData body is sent as multipart; anything else as JSON. With
 * `as: 'blob'` the response body is returned as a Blob (audio downloads).
 */
export type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { anonymous?: boolean; as?: 'json' | 'blob' },
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
      /** One task with its reminder and source capture (for the detail view). */
      get: (id: string) => request<Task>('GET', `/tasks/${id}`),
      create: (task: SaveTaskRequest) => request<Task>('POST', '/tasks', task),
      update: (id: string, task: SaveTaskRequest) => request<Task>('PUT', `/tasks/${id}`, task),
      complete: (id: string) => request<Task>('PATCH', `/tasks/${id}/complete`),
      cancel: (id: string) => request<Task>('PATCH', `/tasks/${id}/cancel`),
      reopen: (id: string) => request<Task>('PATCH', `/tasks/${id}/reopen`),
      remove: (id: string) => request<void>('DELETE', `/tasks/${id}`),
    },
    appointments: {
      /** One appointment with its reminder and source capture (for the detail view). */
      get: (id: string) => request<Appointment>('GET', `/appointments/${id}`),
      create: (appointment: CreateAppointmentRequest) => request<Appointment>('POST', '/appointments', appointment),
      update: (id: string, appointment: CreateAppointmentRequest) =>
        request<Appointment>('PUT', `/appointments/${id}`, appointment),
      complete: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/complete`),
      cancel: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/cancel`),
      reopen: (id: string) => request<Appointment>('PATCH', `/appointments/${id}/reopen`),
      remove: (id: string) => request<void>('DELETE', `/appointments/${id}`),
    },
    feed: {
      /** One page of the unified feed. `kinds` empty/omitted = everything. */
      page: ({ kinds, sort = 'CreatedDesc', cursor, take = 30 }: { kinds?: FeedKind[]; sort?: FeedSort; cursor?: string | null; take?: number }) => {
        const params = new URLSearchParams({ sort, take: String(take) })
        if (kinds?.length) params.set('kinds', kinds.join(','))
        if (cursor) params.set('cursor', cursor)
        return request<FeedPage>('GET', `/feed?${params}`)
      },
    },
    notes: {
      list: (search?: string) =>
        request<Note[]>('GET', `/notes${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      get: (id: string) => request<Note>('GET', `/notes/${id}`),
      create: (note: SaveNoteRequest) => request<Note>('POST', '/notes', note),
      update: (id: string, note: SaveNoteRequest) => request<Note>('PUT', `/notes/${id}`, note),
      remove: (id: string) => request<void>('DELETE', `/notes/${id}`),
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
      /** Part `part` (0-based, < Capture.audioParts) of the original recording. */
      audio: (id: string, part = 0) => request<Blob>('GET', `/captures/${id}/audio?part=${part}`, undefined, { as: 'blob' }),
      deleteAudio: (id: string) => request<void>('DELETE', `/captures/${id}/audio`),
    },
  }
}
