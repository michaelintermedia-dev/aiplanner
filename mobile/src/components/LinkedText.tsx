import { linkify } from '@shared/links'
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native'
import { useColors } from '@/theme'

/** Text with its web links tappable (the browser or the app the link belongs to). Same as the web's LinkedText. */
export function LinkedText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return (
    <Text style={style} selectable>
      {linkify(text).map((p, i) =>
        p.url ? (
          <Text key={i} style={{ color: c.accent, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(p.url)} accessibilityRole="link">
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  )
}
