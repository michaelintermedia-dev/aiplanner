import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * "Take photo": the app's own camera, so it always starts on the back lens
 * (photos of things - a flyer, a receipt). The phone's camera app, which
 * expo-image-picker opened, ignored the request and kept the selfie camera.
 */
export function CameraCapture({
  visible,
  onShot,
  onClose,
}: {
  visible: boolean
  onShot: (shot: { uri: string; width: number; height: number }) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const camera = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) void requestPermission()
    if (!visible) {
      setReady(false)
      setFacing('back')
    }
  }, [visible, permission, requestPermission])

  const shoot = async () => {
    if (!camera.current || busy || !ready) return
    setBusy(true)
    try {
      const shot = await camera.current.takePictureAsync({ quality: 1, exif: false })
      if (shot) onShot({ uri: shot.uri, width: shot.width, height: shot.height })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} />
        ) : (
          permission && (
            <View style={styles.denied}>
              <Text style={styles.deniedText}>{t('camera.noPermission')}</Text>
              {!permission.canAskAgain && (
                <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" style={styles.settings}>
                  <Text style={styles.settingsText}>{t('camera.openSettings')}</Text>
                </Pressable>
              )}
            </View>
          )
        )}

        <Pressable
          onPress={onClose}
          style={[styles.round, styles.close, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel={t('media.close')}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        {permission?.granted && (
          <View style={[styles.bar, { bottom: insets.bottom + 28 }]}>
            <View style={styles.side} />
            <Pressable
              onPress={() => void shoot()}
              disabled={!ready || busy}
              style={[styles.shutter, (!ready || busy) && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={t('media.takePhoto')}>
              {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
            </Pressable>
            <Pressable
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              style={[styles.round, styles.side]}
              accessibilityRole="button"
              accessibilityLabel={t('camera.flip')}>
              <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  close: { position: 'absolute', end: 16 },
  bar: { position: 'absolute', start: 0, end: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { width: 48, height: 48 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  deniedText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  settings: { borderWidth: 1, borderColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  settingsText: { color: '#fff', fontSize: 15 },
})
