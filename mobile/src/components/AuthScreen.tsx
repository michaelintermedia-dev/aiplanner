import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { SocialSignIn } from './SocialSignIn'
import { Button } from './ui'
import { t } from '@shared/i18n'

/** The app icon (the Gatazee cat). */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a bundled image
const CAT = require('../../assets/images/icon.png')

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export function AuthScreen() {
  const c = useColors()
  const { login, register, adoptSession } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = (next: Mode) => {
    setMode(next)
    setError(null)
    setCode('')
    if (next === 'reset' || next === 'forgot') setPassword('')
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else if (mode === 'register') await register(email.trim(), password, displayName.trim())
      else if (mode === 'forgot') {
        // "Forgot password?" (production prep, 2026-10-12): a code by email, then a new password.
        await authApi.forgotPassword(email.trim())
        go('reset')
      } else await adoptSession(await authApi.resetPassword(email.trim(), code, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]
  const prompt = {
    login: t('auth.signInPrompt'),
    register: t('auth.registerPrompt'),
    forgot: t('auth.forgotPrompt'),
    reset: t('auth.resetPrompt', { email: email.trim() }),
  }[mode]
  const action = { login: t('auth.signIn'), register: t('auth.createAccount'), forgot: t('auth.sendCode'), reset: t('auth.resetSave') }[mode]
  const ready = mode === 'forgot' ? !!email : mode === 'reset' ? !!code && password.length >= 8 : !!email && !!password

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.page }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={[styles.form, c.panel]}>
          <View style={styles.brandRow}>
            <Image source={CAT} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={[styles.brand, { color: c.text }]}>{t('app.name')}</Text>
          </View>
          <Text style={{ color: c.muted, marginBottom: 12 }}>{prompt}</Text>
          {mode === 'register' && (
            <TextInput
              style={input}
              placeholder={t('auth.name')}
              placeholderTextColor={c.muted}
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
            />
          )}
          {mode !== 'reset' && (
            <TextInput
              style={input}
              placeholder={t('auth.email')}
              placeholderTextColor={c.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          )}
          {mode === 'reset' && (
            <TextInput
              style={input}
              placeholder={t('email.code')}
              placeholderTextColor={c.muted}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={12}
            />
          )}
          {mode !== 'forgot' && (
            <TextInput
              style={input}
              placeholder={mode === 'reset' ? t('password.new') : t('auth.password')}
              placeholderTextColor={c.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onSubmitEditing={() => void submit()}
            />
          )}
          {error && <Text style={{ color: c.danger }}>{error}</Text>}
          <Button title={action} variant="primary" onPress={() => void submit()} busy={busy} disabled={!ready} />
          {mode === 'login' && providers.data?.emailEnabled && (
            <Pressable onPress={() => go('forgot')} style={styles.switch}>
              <Text style={{ color: c.muted }}>{t('auth.forgot')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => go(mode === 'login' ? 'register' : 'login')}
            style={styles.switch}>
            <Text style={{ color: c.muted }}>
              {mode === 'login' ? t('auth.toRegister') : mode === 'register' ? t('auth.toSignIn') : t('auth.backToSignIn')}
            </Text>
          </Pressable>
          {(mode === 'login' || mode === 'register') && <SocialSignIn onError={setError} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  form: { gap: 12 },
  brand: { fontSize: 30, fontWeight: '700' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  switch: { alignItems: 'center', paddingVertical: 8 },
})
