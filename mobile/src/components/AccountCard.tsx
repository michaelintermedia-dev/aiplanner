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
 * Settings - Account (production prep, 2026-10-12): the password (change it, or
 * set one on a Google/Apple-only account), sign out of all devices, download
 * everything (a ZIP to the share sheet), delete it for good (the email - and
 * the password, if there is one - confirm it). Same as the web's AccountCard.
 */
export function AccountCard() {
  const c = useColors()
  const { user, logout, adoptSession } = useAuth()
  const [busy, setBusy] = useState<'export' | 'delete' | 'password' | 'signout' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  if (!user) return null
  const hasPassword = user.hasPassword !== false
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase() && (!hasPassword || deletePassword.length > 0)
  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]

  const run = async (what: NonNullable<typeof busy>, work: () => Promise<void>) => {
    setBusy(what)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const download = () =>
    run('export', async () => {
      await authApi.me() // refreshes the sign-in if it expired - the download below can't
      const folder = new Directory(Paths.cache, 'export')
      if (folder.exists) folder.delete()
      folder.create({ intermediates: true })
      const target = new File(folder, `ai-planner-${new Date().toISOString().slice(0, 10)}.zip`)
      await File.downloadFileAsync(`${API_URL}/api/users/me/export`, target, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      await Sharing.shareAsync(target.uri, { mimeType: 'application/zip', dialogTitle: t('account.export') })
    })

  const savePassword = () => {
    if (next.length < 8) return setError(t('password.tooShort'))
    void run('password', async () => {
      await adoptSession(await authApi.changePassword(next, hasPassword ? current : undefined))
      setChanging(false)
      setCurrent('')
      setNext('')
      setNotice(t('password.changed'))
    })
  }

  const signOutAll = () =>
    run('signout', async () => {
      await authApi.signOutEverywhere()
      await logout()
    })

  const remove = () => {
    if (!confirmed) return
    void run('delete', async () => {
      await authApi.deleteAccount(typed.trim(), hasPassword ? deletePassword : undefined)
      await logout() // the session is gone with the account; back to the sign-in screen
    })
  }

  return (
    <View style={styles.box}>
      <Text style={[styles.heading, { color: c.muted }]}>{t('account.title').toUpperCase()}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('account.signedInAs', { email: user.email })}</Text>

      {!changing ? (
        <View style={styles.action}>
          <Button title={hasPassword ? t('password.change') : t('password.set')} onPress={() => setChanging(true)} disabled={busy !== null} />
          {!hasPassword && <Text style={{ color: c.muted, fontSize: 13 }}>{t('password.setHint')}</Text>}
        </View>
      ) : (
        <View style={styles.form}>
          {hasPassword && (
            <>
              <Text style={{ color: c.muted, fontSize: 13 }}>{t('password.current')}</Text>
              <TextInput value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" style={input} />
            </>
          )}
          <Text style={{ color: c.muted, fontSize: 13 }}>{t('password.new')}</Text>
          <TextInput value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" style={input} onSubmitEditing={savePassword} />
          <View style={styles.row}>
            <Button title={t('common.cancel')} onPress={() => (setChanging(false), setCurrent(''), setNext(''))} disabled={busy !== null} />
            <Button title={t('common.save')} variant="primary" busy={busy === 'password'} onPress={savePassword} disabled={busy !== null} />
          </View>
        </View>
      )}

      <View style={styles.action}>
        {/* Signing out lives here since the header's account menu went (spec v2). */}
        <Button title={t('auth.signOut')} onPress={() => void logout()} disabled={busy !== null} />
        <Button title={t('account.signOutAll')} onPress={() => void signOutAll()} disabled={busy !== null} />
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('account.signOutAllHint')}</Text>
      </View>

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
          <TextInput value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={input} />
          {hasPassword && (
            <>
              <Text style={{ color: c.text }}>{t('account.deletePassword')}</Text>
              <TextInput value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoComplete="current-password" style={input} />
            </>
          )}
          <View style={styles.row}>
            <Button title={t('common.cancel')} onPress={() => (setDeleting(false), setTyped(''), setDeletePassword(''))} disabled={busy !== null} />
            <Button
              title={busy === 'delete' ? t('account.deleting') : t('account.deleteForever')}
              variant="danger"
              onPress={remove}
              disabled={!confirmed || busy !== null}
            />
          </View>
        </View>
      )}
      {notice && <Text style={{ color: c.muted }}>{notice}</Text>}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  action: { gap: 6 },
  form: { gap: 8 },
  delete: { gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
})
