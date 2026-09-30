import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useColors } from '@/theme'

const BARS = 24
/** Below this (dBFS) counts as silence; room noise is typically -60 or lower. */
const SILENCE_DB = -50
const SILENCE_AFTER_MS = 3000

/**
 * Scrolling input-level bars while recording, from the recorder's metering
 * (dBFS). Reports silence after a few seconds without sound, so the user
 * knows the mic isn't hearing them.
 */
export function LevelMeter({
  metering,
  active,
  onSilenceChange,
}: {
  metering: number | undefined
  active: boolean
  onSilenceChange: (silent: boolean) => void
}) {
  const c = useColors()
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0))
  // Set on the first active update (reading the clock during render isn't pure).
  const quietSince = useRef<number | null>(null)
  const silent = useRef(false)

  useEffect(() => {
    const now = Date.now()
    if (!active || quietSince.current === null) {
      quietSince.current = now // paused time doesn't count toward "silent"
      if (!active) return
    }
    const db = metering ?? -160
    const level = Math.max(0, Math.min(1, (db + 60) / 60))
    // New metering arrives every ~100 ms; each reading becomes a bar.
    const id = setTimeout(() => setLevels((l) => [...l.slice(1), level]), 0)

    if (db > SILENCE_DB) {
      quietSince.current = now
      if (silent.current) onSilenceChange((silent.current = false))
    } else if (!silent.current && now - quietSince.current > SILENCE_AFTER_MS) {
      onSilenceChange((silent.current = true))
    }
    return () => clearTimeout(id)
  }, [metering, active, onSilenceChange])

  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {levels.map((level, i) => (
        <View
          key={i}
          style={[styles.bar, { height: 3 + level * 25, backgroundColor: active ? c.accent : c.muted }]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 30 },
  bar: { width: 4, borderRadius: 2 },
})
