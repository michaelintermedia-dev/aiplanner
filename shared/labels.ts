import { t, type MessageKey } from './i18n'

/** Status values from the API ("Completed", "InProgress"...) as shown to the user. */
export const statusLabel = (status: string) => t(`status.${status}` as MessageKey)

/** "High" / "Medium" / "Low" / "None" as shown to the user. */
export const priorityLabel = (priority: string) => t(`priority.${priority}` as MessageKey)
