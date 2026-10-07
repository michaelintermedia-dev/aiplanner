import type { ItemType } from '@shared/types'

const BASE: Record<ItemType, string> = { Task: '/tasks', Appointment: '/appointments', Note: '/notes' }

/** An item's page. */
export const itemPath = (item: { itemType: ItemType; id: string }) => `${BASE[item.itemType]}/${item.id}`
