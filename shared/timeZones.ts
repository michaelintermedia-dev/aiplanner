/**
 * Settings - Time zone (2026-10-18, web + app): every date is shown and worked
 * out in the account's zone, so travellers can switch it. The list is the
 * browser's own when it has one (Intl.supportedValuesOf), else this one (the
 * phone's engine may not) - the main city of every offset and region.
 */
const COMMON = [
  'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Vancouver', 'America/Tijuana',
  'America/Phoenix', 'America/Denver', 'America/Edmonton', 'America/Mexico_City', 'America/Chicago', 'America/Winnipeg',
  'America/Guatemala', 'America/Bogota', 'America/Lima', 'America/New_York', 'America/Toronto', 'America/Havana',
  'America/Caracas', 'America/Halifax', 'America/Santiago', 'America/La_Paz', 'America/Puerto_Rico', 'America/St_Johns',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'Atlantic/South_Georgia', 'Atlantic/Azores',
  'Atlantic/Cape_Verde', 'UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Atlantic/Reykjavik', 'Africa/Casablanca',
  'Africa/Lagos', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Vienna', 'Europe/Zurich', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Warsaw', 'Europe/Prague',
  'Europe/Budapest', 'Europe/Belgrade', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Jerusalem', 'Asia/Beirut', 'Asia/Amman',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Chisinau', 'Europe/Kyiv', 'Europe/Helsinki', 'Europe/Riga', 'Europe/Vilnius',
  'Europe/Tallinn', 'Europe/Sofia', 'Europe/Istanbul', 'Europe/Minsk', 'Europe/Moscow', 'Asia/Baghdad', 'Asia/Riyadh',
  'Asia/Kuwait', 'Asia/Qatar', 'Africa/Nairobi', 'Africa/Addis_Ababa', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Baku', 'Asia/Tbilisi',
  'Asia/Yerevan', 'Europe/Samara', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Yekaterinburg', 'Asia/Kolkata',
  'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Almaty', 'Asia/Omsk', 'Asia/Yangon', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Ho_Chi_Minh', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore',
  'Asia/Kuala_Lumpur', 'Asia/Manila', 'Australia/Perth', 'Asia/Irkutsk', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Yakutsk',
  'Australia/Darwin', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne', 'Asia/Vladivostok',
  'Pacific/Guam', 'Asia/Magadan', 'Pacific/Noumea', 'Asia/Kamchatka', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Tongatapu',
  'Pacific/Kiritimati',
]

/** Every zone to choose from (incl. the current one, even if it's not in the list). */
export function timeZoneChoices(current?: string): string[] {
  let all: string[] = COMMON
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    const own = intl.supportedValuesOf?.('timeZone')
    if (own && own.length > 50) all = own.includes('UTC') ? own : [...own, 'UTC']
  } catch {
    // keep the built-in list
  }
  return current && !all.includes(current) ? [current, ...all] : all
}

/** "New York", "Buenos Aires", "UTC" - the city part of an IANA id. */
export const zoneCity = (id: string) => (id.split('/').pop() ?? id).replace(/_/g, ' ')

/** Minutes the zone is ahead of UTC at that moment (DST included). */
export function zoneOffsetMinutes(zone: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(at)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'))
    return Math.round((local - Math.floor(at.getTime() / 60000) * 60000) / 60000)
  } catch {
    return 0
  }
}

/** "GMT+3", "GMT-4", "GMT+5:30", "GMT". */
export function zoneOffsetLabel(zone: string, at = new Date()): string {
  const m = zoneOffsetMinutes(zone, at)
  if (m === 0) return 'GMT'
  const sign = m > 0 ? '+' : '-'
  const abs = Math.abs(m)
  return `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`
}

/** "New York (GMT-4)". */
export const zoneLabel = (zone: string, at = new Date()) => `${zoneCity(zone)} (${zoneOffsetLabel(zone, at)})`

/** Zones whose city or id contains every word typed (any order), best first: the city starting with it. */
export function searchZones(zones: string[], text: string, max = 8): string[] {
  const words = text.toLowerCase().replace(/_/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hay = (z: string) => z.toLowerCase().replace(/_/g, ' ')
  return zones
    .filter((z) => words.every((w) => hay(z).includes(w)))
    .sort((a, b) => Number(!zoneCity(a).toLowerCase().startsWith(words[0])) - Number(!zoneCity(b).toLowerCase().startsWith(words[0])))
    .slice(0, max)
}
