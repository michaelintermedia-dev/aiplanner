import { createApi } from '@shared/endpoints'
import { request } from './client'

/** The whole API (for shared helpers that take it, e.g. saveItemForm). */
export const api = createApi(request)

export const authApi = api.auth
export const tasksApi = api.tasks
export const appointmentsApi = api.appointments
export const todayApi = api.today
export const calendarApi = api.calendar
export const capturesApi = api.captures
export const notesApi = api.notes
export const feedApi = api.feed
export const notificationsApi = api.notifications
export const settingsApi = api.settings
export const itemsApi = api.items
