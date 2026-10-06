import type {
  Appointment,
  Attachment,
  AuthResponse,
  CalendarRange,
  CalendarView,
  Capture,
  ItemType,
  CaptureSummary,
  ConfirmCaptureItem,
  ConvertedItem,
  ConvertItemRequest,
  ItemRef,
  ItemsResult,
  RecordingSettings,
  CreateAppointmentRequest,
  FeedKind,
  FeedPage,
  FeedSort,
  Note,
  NotificationSettings,
  SaveNoteRequest,
  SnoozeRequest,
  SaveTaskRequest,
  Task,
  Today,
  UpcomingNotification,
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
      register: (email: string, password: string, displayName: string, timeZoneId: string, locale: string) =>
        request<AuthResponse>(
          'POST',
          '/auth/register',
          { email, password, displayName, timeZoneId, locale },
          { anonymous: true },
        ),
      logout: (refreshToken: string) => request<void>('POST', '/auth/logout', { refreshToken }),
      me: () => request<User>('GET', '/users/me'),
      /** Change the language/locale (BCP 47). */
      updateProfile: (body: { locale?: string }) => request<User>('PATCH', '/users/me', body),
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
      /** A repeating event: skip one occurrence (its start), or bring it back. */
      skip: (id: string, atUtc: string) => request<Appointment>('POST', `/appointments/${id}/skip?at=${encodeURIComponent(atUtc)}`),
      unskip: (id: string, atUtc: string) => request<Appointment>('DELETE', `/appointments/${id}/skip?at=${encodeURIComponent(atUtc)}`),
    },
    feed: {
      /** One page of the unified feed. `kinds` empty/omitted = everything. */
      page: ({
        kinds,
        sort = 'CreatedDesc',
        cursor,
        take = 30,
        filters,
      }: {
        kinds?: FeedKind[]
        /** One criterion or several, applied in order. */
        sort?: FeedSort | FeedSort[]
        cursor?: string | null
        take?: number
        /** From feedFilterParams() in feedFilter.ts. */
        filters?: Record<string, string>
      }) => {
        const params = new URLSearchParams({ sort: [sort].flat().join(',') || 'CreatedDesc', take: String(take), ...filters })
        if (kinds?.length) params.set('kinds', kinds.join(','))
        if (cursor) params.set('cursor', cursor)
        return request<FeedPage>('GET', `/feed?${params}`)
      },
      /** The user's tags in use, most used first (for the tag filter). */
      tags: () => request<{ name: string; count: number }[]>('GET', '/feed/tags'),
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
    items: {
      /** Turn a task / event / note into another type; the old item is replaced. */
      convert: (body: ConvertItemRequest) => request<ConvertedItem>('POST', '/items/convert', body),
      /** Delete one or many items of any type at once (soft - `restore` undoes it). */
      delete: (items: ItemRef[]) => request<ItemsResult>('POST', '/items/delete', { items }),
      /** Undo a delete. */
      restore: (items: ItemRef[]) => request<ItemsResult>('POST', '/items/restore', { items }),
    },
    attachments: {
      /** An item's photos and documents, oldest first. */
      list: (itemType: ItemType, id: string) => request<Attachment[]>('GET', `/items/${itemType}/${id}/attachments`),
      /** Upload one file: a FormData with it in field "file". */
      upload: (itemType: ItemType, id: string, form: FormData) =>
        request<Attachment>('POST', `/items/${itemType}/${id}/attachments`, form),
      /** The file itself (needs the sign-in, so it's fetched rather than linked). */
      content: (id: string) => request<Blob>('GET', `/attachments/${id}/content`, undefined, { as: 'blob' }),
      remove: (id: string) => request<void>('DELETE', `/attachments/${id}`),
    },
    notifications: {
      /** Everything that should go off in the next `hours` hours (Phase 4). */
      upcoming: (hours = 168) => request<UpcomingNotification[]>('GET', `/notifications/upcoming?hours=${hours}`),
      snooze: (body: SnoozeRequest) => request<UpcomingNotification>('POST', '/notifications/snooze', body),
    },
    settings: {
      notifications: () => request<NotificationSettings>('GET', '/settings/notifications'),
      updateNotifications: (body: NotificationSettings) => request<NotificationSettings>('PUT', '/settings/notifications', body),
      recordings: () => request<RecordingSettings>('GET', '/settings/recordings'),
      updateRecordings: (body: RecordingSettings) => request<RecordingSettings>('PUT', '/settings/recordings', body),
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
      /**
       * Add to an existing capture ("continue talking"): FormData with "audio"
       * part(s) and/or "text", plus "itemType"/"itemId" of the item continued from.
       * Returns the capture with the new items to review.
       */
      continue: (id: string, form: FormData) => request<Capture>('POST', `/captures/${id}/continue`, form),
      /** With `pendingDays`: only captures of the last N days with a review left unsaved. */
      list: (take = 50, pendingDays?: number) =>
        request<CaptureSummary[]>('GET', `/captures?take=${take}${pendingDays ? `&pendingDays=${pendingDays}` : ''}`),
      /** Rejects every proposal still waiting for review; returns how many. */
      discardPending: () => request<number>('POST', '/captures/pending/discard'),
      get: (id: string) => request<Capture>('GET', `/captures/${id}`),
      confirm: (id: string, items: ConfirmCaptureItem[]) =>
        request<Capture>('POST', `/captures/${id}/confirm`, { items }),
      /** Part `part` (0-based, < Capture.audioParts) of the original recording. */
      audio: (id: string, part = 0) => request<Blob>('GET', `/captures/${id}/audio?part=${part}`, undefined, { as: 'blob' }),
      deleteAudio: (id: string) => request<void>('DELETE', `/captures/${id}/audio`),
      /** The capture an item's voice/text additions go into (made for an item created by hand). */
      forItem: (itemType: ItemType, itemId: string) => request<Capture>('POST', '/captures/for-item', { itemType, itemId }),
    },
  }
}
