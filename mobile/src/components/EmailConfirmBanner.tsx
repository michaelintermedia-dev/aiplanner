import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { Button } from './ui'

/**
 * "Confirm your email" with the 6-digit code (production prep, 2026-10-12):
 * shown while the account's email isn't confirmed and the server sends email.
 * The AI waits for it. Same as the web's EmailConfirmBanner.
 */
export function EmailConfirmBanner() {
  const c = useColors()
  const { user, reloadUser } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  if (!user || user.emailConfirmed !== false || !providers.data?.emailEnabled) return null

  const confirm = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await authApi.verifyEmail(code)
      await reloadUser() // the banner goes away
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t('common.error'), error: true })
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setMessage(null)
    try {
      await authApi.sendVerification()
      setMessage({ text: t('email.sent') })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t('common.error'), error: true })
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]} accessibilityLabel={t('email.confirmTitle')}>
      <View style={styles.row}>
        <Ionicons name="mail-outline" size={18} color={c.accent} />
        <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{t('email.confirmTitle')}</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('email.confirmBody', { email: user.email })}</Text>
      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="123456"
          placeholderTextColor={c.muted}
          maxLength={12}
          accessibilityLabel={t('email.code')}
          style={[styles.input, { color: c.text, borderColor: c.border }]}
        />
        <Button title={t('email.confirm')} variant="primary" busy={busy} disabled={code.replace(/\D/g, '').length !== 6} onPress={() => void confirm()} />
      </View>
      <Pressable onPress={() => void resend()} accessibilityRole="button" hitSlop={6}>
        <Text style={{ color: c.accent }}>{t('email.resend')}</Text>
      </Pressable>
      {message && <Text style={{ color: message.error ? c.danger : c.muted, fontSize: 13 }}>{message.text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 18, letterSpacing: 4 },
})
