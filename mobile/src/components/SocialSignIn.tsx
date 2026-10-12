import Ionicons from '@expo/vector-icons/Ionicons'
import type { ExternalSignIn } from '@shared/types'
import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'

/**
 * "Continue with Google / Apple" under the sign-in form (user's request,
 * 2026-10-12) - same as the web's SocialSignIn. Only providers the server has
 * ids for are shown. Google: Android (an iPhone needs its own Google client
 * id first). Apple: iPhone (native); on Android Apple isn't offered.
 */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const c = useColors()
  const { signInWith } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const [busy, setBusy] = useState(false)
  const [appleHere, setAppleHere] = useState(false)
  const google = Platform.OS === 'android' ? providers.data?.googleClientId : null
  const apple = Platform.OS === 'ios' && providers.data?.appleNative && appleHere

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleHere)
  }, [])

  const finish = async (signIn: ExternalSignIn) => {
    try {
      await signInWith(signIn)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('auth.socialFailed'))
      setBusy(false)
    }
  }

  const withGoogle = async () => {
    if (!google || busy) return
    setBusy(true)
    onError(null)
    try {
      // Loaded only when used: the native module isn't in Expo Go.
      const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin')
      GoogleSignin.configure({ webClientId: google })
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      await GoogleSignin.signOut().catch(() => {}) // always let the user pick the account
      const r = await GoogleSignin.signIn()
      if (!isSuccessResponse(r) || !r.data.idToken) {
        setBusy(false) // cancelled
        return
      }
      await finish({ provider: 'google', idToken: r.data.idToken, displayName: r.data.user.name ?? undefined })
    } catch {
      onError(t('auth.socialFailed'))
      setBusy(false)
    }
  }

  const withApple = async () => {
    if (busy) return
    setBusy(true)
    onError(null)
    try {
      const nonce = Crypto.randomUUID()
      const r = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      })
      if (!r.identityToken) throw new Error('no token')
      const name = [r.fullName?.givenName, r.fullName?.familyName].filter(Boolean).join(' ')
      await finish({ provider: 'apple', idToken: r.identityToken, nonce, displayName: name || undefined })
    } catch (err) {
      if (!(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_REQUEST_CANCELED')) {
        onError(t('auth.socialFailed'))
      }
      setBusy(false)
    }
  }

  if (!google && !apple) return null
  return (
    <View style={styles.box}>
      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={{ color: c.muted }}>{t('auth.or')}</Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      {google && (
        <Pressable
          onPress={() => void withGoogle()}
          disabled={busy}
          style={({ pressed }) => [styles.button, { backgroundColor: c.surface, borderColor: c.border, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}
          accessibilityRole="button">
          <Ionicons name="logo-google" size={20} color={c.text} />
          <Text style={[styles.label, { color: c.text }]}>{t('auth.withGoogle')}</Text>
        </Pressable>
      )}
      {apple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={c.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999}
          style={styles.appleButton}
          onPress={() => void withApple()}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, borderRadius: 999, borderWidth: 1 },
  label: { fontSize: 16, fontWeight: '600' },
  appleButton: { height: 48 },
})
