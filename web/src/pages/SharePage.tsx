import { useEffect } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { offerShared, sharedText } from '../lib/sharedIn'

/**
 * The share target (manifest share_target, GET /share?title=&text=&url=):
 * hands what was shared to the capture bar and goes to the feed, where it's
 * saved as a new entry.
 */
export function SharePage() {
  const [params] = useSearchParams()
  const visit = useLocation().key
  const text = sharedText(params.get('title'), params.get('text'), params.get('url'))
  useEffect(() => {
    if (text) offerShared(text, visit)
  }, [text, visit])
  return <Navigate to="/feed" replace />
}
