import type { ItemType } from '@shared/types'

const BASE: Record<ItemType, string> = { Task: '/task', Appointment: '/appointment', Note: '/note' }

/** An item's screen (an expo-router path). */
export const itemPath = (item: { itemType: ItemType; id: string }) => `${BASE[item.itemType]}/${item.id}`
