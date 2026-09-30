import { createApi } from '@shared/endpoints'
import { request } from './client'

const api = createApi(request)

export const authApi = api.auth
export const tasksApi = api.tasks
export const appointmentsApi = api.appointments
export const todayApi = api.today
export const calendarApi = api.calendar
export const capturesApi = api.captures
