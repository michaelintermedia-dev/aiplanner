/**
 * "Show in your phone's calendar" (2026-10-23, web + app): the private feed link
 * and the ways to add it. Google takes it through its "add by URL" page; Apple
 * Calendar and Outlook open webcal:// links themselves.
 */
export const webcalUrl = (httpsUrl: string) => httpsUrl.replace(/^https?:\/\//, 'webcal://')

export const googleCalendarAddUrl = (httpsUrl: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(httpsUrl))}`
