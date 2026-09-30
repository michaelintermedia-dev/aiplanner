import { useEffect, useRef } from 'react'

const BARS = 28
/** RMS below this counts as silence (a quiet room reads ~0.002-0.005). */
const SILENCE_LEVEL = 0.012
/** Report silence after this much *recording* time without any sound. */
const SILENCE_AFTER_MS = 3000

/**
 * Live input level while recording: bars scroll left as you speak, so the user
 * can see the mic hears them. Draws on a canvas in its own animation loop (no
 * React re-render per frame). Calls onSilenceChange(true) if nothing above
 * room noise is heard for a few seconds, and (false) once sound arrives.
 */
export function LevelMeter({
  stream,
  active,
  onSilenceChange,
}: {
  stream: MediaStream
  active: boolean
  onSilenceChange: (silent: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const onSilenceRef = useRef(onSilenceChange)

  useEffect(() => {
    activeRef.current = active
    onSilenceRef.current = onSilenceChange
  })

  useEffect(() => {
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const levels = new Array<number>(BARS).fill(0)
    let frame = 0
    let lastBar = 0
    let quietSince = performance.now()
    let silent = false

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c) return

      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      const rms = Math.sqrt(sum / samples.length)

      if (!activeRef.current) {
        quietSince = now // paused time doesn't count toward "silent"
      } else if (rms > SILENCE_LEVEL) {
        quietSince = now
        if (silent) onSilenceRef.current((silent = false))
      } else if (!silent && now - quietSince > SILENCE_AFTER_MS) {
        onSilenceRef.current((silent = true))
      }

      // Push a new bar ~every 60 ms while recording; freeze while paused.
      if (activeRef.current && now - lastBar > 60) {
        lastBar = now
        levels.shift()
        levels.push(Math.min(1, rms * 6))
      }

      const g = c.getContext('2d')!
      const { width, height } = c
      g.clearRect(0, 0, width, height)
      g.fillStyle = getComputedStyle(c).color
      const barWidth = width / BARS
      levels.forEach((level, i) => {
        const h = Math.max(2, level * height)
        g.fillRect(i * barWidth + 1, (height - h) / 2, barWidth - 2, h)
      })
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      void context.close()
    }
  }, [stream])

  return <canvas ref={canvas} className={`level-meter${active ? ' live' : ''}`} width={168} height={28} aria-hidden="true" />
}
