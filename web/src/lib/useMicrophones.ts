import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aiplanner.micDeviceId'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * The computer's audio inputs and the user's chosen one (remembered in this
 * browser). Device names are only visible after mic permission is granted, so
 * the list is refreshed after the first recording and when devices change.
 */
export function useMicrophones() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selected, setSelected] = useState<string | null>(readStored)

  const refresh = useCallback(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((all) =>
        // Without permission, entries have empty labels - not useful to pick from.
        // Chrome on Windows also lists "default"/"communications" aliases; the
        // picker offers "System default" itself, so keep only real devices.
        setDevices(
          all.filter(
            (d) => d.kind === 'audioinput' && d.label && d.deviceId !== 'default' && d.deviceId !== 'communications',
          ),
        ),
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    const media = navigator.mediaDevices
    media?.enumerateDevices?.().then(() => refresh())
    media?.addEventListener?.('devicechange', refresh)
    return () => media?.removeEventListener?.('devicechange', refresh)
  }, [refresh])

  const choose = useCallback((deviceId: string | null) => {
    setSelected(deviceId)
    try {
      if (deviceId) localStorage.setItem(STORAGE_KEY, deviceId)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }, [])

  // A remembered device that's no longer plugged in falls back to the default.
  // (Before permission the list is empty - keep the stored choice until we know.)
  const current = devices.length === 0 || devices.some((d) => d.deviceId === selected) ? selected : null

  return { devices, selected: current, choose, refresh }
}
