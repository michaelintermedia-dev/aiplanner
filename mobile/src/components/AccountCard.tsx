import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { API_URL, getAccessToken } from '@/api/client'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { Button } from './ui'

/**
 * Settings - Account (production prep, 2026-10-12): download everything in the
 * account (a ZIP handed to the share sheet - save it or send it), or delete
 * it for good (typing the email to confirm). Same as the web's AccountCard.
 */
export function AccountCard() {
  const c = useColors()
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  if (!user) return null
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase()

  const download = async () => {
    setBusy('export')
    setError(null)
    try {
      await authApi.me() // refreshes the sign-in if it expired - the download below can't
      const folder = new Directory(Paths.cache, 'export')
      if (folder.exists) folder.delete()
      folder.create({ intermediates: true })
      const target = new File(folder, `ai-planner-${new Date().toISOString().slice(0, 10)}.zip`)
      await File.downloadFileAsync(`${API_URL}/api/users/me/export`, target, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      await Sharing.shareAsync(target.uri, { mimeType: 'application/zip', dialogTitle: t('account.export') })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirmed) return
    setBusy('delete')
    setError(null)
    try {
      await authApi.deleteAccount(typed.trim())
      await logout() // the session is gone with the account; back to the sign-in screen
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setBusy(null)
    }
  }

  return (
    <View style={styles.box}>
      <Text style={[styles.heading, { color: c.muted }]}>{t('account.title').toUpperCase()}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('account.signedInAs', { email: user.email })}</Text>

      <View style={styles.action}>
        <Button title={busy === 'export' ? t('account.exporting') : t('account.export')} onPress={() => void download()} disabled={busy !== null} />
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('account.exportHint')}</Text>
      </View>

      {!deleting ? (
        <Button title={t('account.delete')} variant="danger" onPress={() => setDeleting(true)} disabled={busy !== null} />
      ) : (
        <View style={[styles.delete, { borderColor: c.danger }]}>
          <View style={styles.row}>
            <Ionicons name="warning-outline" size={18} color={c.danger} />
            <Text style={{ color: c.text, flex: 1 }}>{t('account.deleteHint')}</Text>
          </View>
          <Text style={{ color: c.text }}>{t('account.deleteConfirm', { email: user.email })}</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <View style={styles.row}>
            <Button title={t('common.cancel')} onPress={() => (setDeleting(false), setTyped(''))} disabled={busy !== null} />
            <Button
              title={busy === 'delete' ? t('account.deleting') : t('account.deleteForever')}
              variant="danger"
              onPress={() => void remove()}
              disabled={!confirmed || busy !== null}
            />
          </View>
        </View>
      )}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  action: { gap: 6 },
  delete: { gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
})
