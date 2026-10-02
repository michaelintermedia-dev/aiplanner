import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { Button } from './ui'
import { t } from '@shared/i18n'

export function AuthScreen() {
  const c = useColors()
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, displayName.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.form}>
          <Text style={[styles.brand, { color: c.text }]}>{t('app.name')}</Text>
          <Text style={{ color: c.muted, marginBottom: 12 }}>
            {mode === 'login' ? t('auth.signInPrompt') : t('auth.registerPrompt')}
          </Text>
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
          <TextInput
            style={input}
            placeholder={t('auth.password')}
            placeholderTextColor={c.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
          />
          {error && <Text style={{ color: c.danger }}>{error}</Text>}
          <Button
            title={mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            variant="primary"
            onPress={submit}
            busy={busy}
            disabled={!email || !password}
          />
          <Pressable
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
            style={styles.switch}>
            <Text style={{ color: c.muted }}>
              {mode === 'login' ? t('auth.toRegister') : t('auth.toSignIn')}
            </Text>
          </Pressable>
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
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  switch: { alignItems: 'center', paddingVertical: 8 },
})
