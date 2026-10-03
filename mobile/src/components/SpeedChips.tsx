import { t } from '@shared/i18n'
import { SPEEDS, speedLabel } from '@shared/playbackSpeed'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { usePlaybackSpeed } from '@/lib/playbackSpeed'
import { useColors } from '@/theme'

/** 1× · 1.5× · 2× next to a player (same as web); the choice applies to every player. */
export function SpeedChips() {
  const c = useColors()
  const [speed, setSpeed] = usePlaybackSpeed()
  return (
    <View style={[styles.row, { borderColor: c.border }]} accessibilityRole="radiogroup" accessibilityLabel={t('player.speed')}>
      {SPEEDS.map((s) => {
        const on = speed === s
        return (
          <Pressable
            key={s}
            onPress={() => setSpeed(s)}
            style={[styles.chip, on && { backgroundColor: c.accent }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}>
            <Text style={{ color: on ? '#fff' : c.text, fontWeight: '600' }}>{speedLabel(s)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
})
