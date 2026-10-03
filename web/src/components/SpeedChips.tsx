import { t } from '@shared/i18n'
import { SPEEDS, speedLabel } from '@shared/playbackSpeed'
import { usePlaybackSpeed } from '../lib/playbackSpeed'

/** 1× · 1.5× · 2× next to a player (same as mobile); the choice applies to every player. */
export function SpeedChips() {
  const [speed, setSpeed] = usePlaybackSpeed()
  return (
    <div className="segmented small speed-chips" role="radiogroup" aria-label={t('player.speed')}>
      {SPEEDS.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={speed === s} className={speed === s ? 'active' : undefined} onClick={() => setSpeed(s)}>
          {speedLabel(s)}
        </button>
      ))}
    </div>
  )
}
