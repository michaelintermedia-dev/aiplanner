import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { placeLinks } from '@shared/links'
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, Text } from 'react-native'
import { useColors } from '@/theme'

/**
 * An item's place: tap it to pick where it opens - Google Maps or Waze (and
 * Apple Maps on iPhone) - user's request, 2026-10-12. A map link shows as
 * "Map link". Same as the web's PlaceLink.
 */
export function PlaceLink({ place }: { place: string }) {
  const c = useColors()
  const links = placeLinks(place)

  const choose = () => {
    const choices = [
      { label: t('place.googleMaps'), url: links.google },
      ...(links.waze ? [{ label: t('place.waze'), url: links.waze }] : []),
      ...(Platform.OS === 'ios' ? [{ label: t('place.appleMaps'), url: links.apple }] : []),
    ]
    const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert(t('common.error')))
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t('place.openIn'), options: [...choices.map((x) => x.label), t('common.cancel')], cancelButtonIndex: choices.length },
        (i) => i < choices.length && open(choices[i].url),
      )
    } else {
      Alert.alert(t('place.openIn'), links.isLink ? undefined : place, [
        ...choices.map((x) => ({ text: x.label, onPress: () => open(x.url) })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ])
    }
  }

  return (
    <Pressable onPress={choose} accessibilityRole="button" accessibilityHint={t('place.openIn')} hitSlop={6}>
      <Text style={{ color: c.accent, fontSize: 15 }}>
        <Ionicons name="map-outline" size={15} color={c.accent} /> {links.isLink ? t('place.mapLink') : place}
      </Text>
    </Pressable>
  )
}
