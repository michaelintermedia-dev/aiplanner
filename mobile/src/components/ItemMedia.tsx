import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { formatSize, splitMedia } from '@shared/media'
import type { Attachment, ItemType } from '@shared/types'
import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, I18nManager, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { attachmentSource, openAttachment, pickDocuments, pickPhotos, useAttachments, type Picked, type PendingMedia } from '@/lib/media'
import { useColors } from '@/theme'
import { useCardStyle } from './panel'

const COLUMNS = 3
const GAP = 6

/**
 * Square thumbnails, three a row. Sized from the measured width: a percentage
 * width with aspectRatio leaves them 0 high on Android.
 */
function Grid({ children }: { children: (size: number) => ReactNode }) {
  const [width, setWidth] = useState(0)
  const size = width ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {size > 0 && children(size)}
    </View>
  )
}

/** A stored picture (with the sign-in header; kept in expo-image's cache). */
function StoredImage({ id, fit = 'cover' }: { id: string; fit?: 'cover' | 'contain' }) {
  const c = useColors()
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{t('media.loadFailed')}</Text>
      </View>
    )
  }
  return <Image source={attachmentSource(id)} style={StyleSheet.absoluteFill} contentFit={fit} cachePolicy="disk" recyclingKey={id} onError={() => setFailed(true)} transition={150} />
}

/** The item's photos and documents, on its screen (nothing when it has none). Same as the web's. */
export function ItemMedia({ itemType, id }: { itemType: ItemType; id: string }) {
  const c = useColors()
  const { data } = useAttachments(itemType, id)
  const flat = useCardStyle()
  const [open, setOpen] = useState<number | null>(null)
  if (!data?.length) return null
  const { images, files } = splitMedia(data)

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
      <View style={styles.head}>
        <Ionicons name="images-outline" size={14} color={c.muted} />
        <Text style={[styles.heading, { color: c.muted }]}>{t('media.title').toUpperCase()}</Text>
      </View>
      {images.length > 0 && (
        <Grid>
          {(size) =>
            images.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => setOpen(i)}
                style={[styles.thumb, { width: size, height: size, borderColor: c.border, backgroundColor: c.surface2 }]}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('media.open', { name: a.fileName })}>
                <StoredImage id={a.id} />
              </Pressable>
            ))
          }
        </Grid>
      )}
      {files.map((a) => (
        <FileRow key={a.id} attachment={a} />
      ))}
      <Viewer images={images} index={open} onClose={() => setOpen(null)} />
    </View>
  )
}

function FileRow({ attachment: a, removed, onToggle }: { attachment: Attachment; removed?: boolean; onToggle?: () => void }) {
  const c = useColors()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await openAttachment(a)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={styles.fileRow}>
      <Pressable
        onPress={() => void open()}
        disabled={busy || removed}
        style={[styles.file, { borderColor: c.border, backgroundColor: c.surface }]}
        accessibilityRole="button"
        accessibilityLabel={t('media.open', { name: a.fileName })}>
        {busy ? <ActivityIndicator size="small" color={c.muted} /> : <Ionicons name="document-text-outline" size={20} color={c.muted} />}
        <View style={styles.fileName}>
          <Text style={{ color: removed ? c.muted : c.text, textDecorationLine: removed ? 'line-through' : 'none' }} numberOfLines={1}>
            {a.fileName}
          </Text>
          {/* What the AI says it shows (searchable). */}
          {!!a.description && (
            <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={3}>
              {a.description}
            </Text>
          )}
        </View>
        <Text style={{ color: failed ? c.danger : c.muted, fontSize: 12 }}>
          {failed ? t('media.loadFailed') : removed ? t('media.willBeRemoved') : formatSize(a.sizeBytes)}
        </Text>
      </Pressable>
      {onToggle && <RemoveToggle removed={!!removed} onPress={onToggle} onCard />}
    </View>
  )
}

function RemoveToggle({ removed, onPress, onCard }: { removed: boolean; onPress: () => void; onCard?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.remove, onCard ? { backgroundColor: c.surface2 } : styles.removeOnImage]}
      accessibilityRole="button"
      accessibilityLabel={removed ? t('common.undo') : t('media.remove')}>
      <Ionicons name={removed ? 'arrow-undo-outline' : 'close'} size={16} color={onCard ? c.text : '#fff'} />
    </Pressable>
  )
}

/** The pictures full screen, swiping between them. */
function Viewer({ images, index, onClose }: { images: Attachment[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [at, setAt] = useState(0)
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        {index !== null && (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            inverted={I18nManager.isRTL}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
            onLayout={() => setAt(index)}
            renderItem={({ item }) => (
              <View style={{ width, height }} accessibilityLabel={item.description ?? item.fileName}>
                <StoredImage id={item.id} fit="contain" />
              </View>
            )}
          />
        )}
        <Pressable
          onPress={onClose}
          style={[styles.viewerClose, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel={t('media.close')}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        {!!images[at]?.description && (
          <Text style={[styles.viewerCaption, { bottom: insets.bottom + (images.length > 1 ? 44 : 16) }]}>{images[at].description}</Text>
        )}
        {images.length > 1 && (
          <Text style={[styles.viewerCount, { bottom: insets.bottom + 16 }]}>
            {at + 1} / {images.length}
          </Text>
        )}
      </View>
    </Modal>
  )
}

/**
 * The Edit screen's media part: what the item has (each can be marked for
 * removal), what was just picked (uploaded on Save), and Take photo / Add
 * image / Attach file. Without an item (the capture bar's drawer) only
 * what's picked, added once it's saved. Same as the web's MediaEditor.
 */
export function MediaEditor({
  itemType,
  id,
  pending,
  onPending,
  removed = [],
  onRemoved = () => {},
  bare,
}: {
  itemType?: ItemType
  id?: string
  pending: PendingMedia[]
  onPending: (update: (p: PendingMedia[]) => PendingMedia[]) => void
  removed?: string[]
  onRemoved?: (ids: string[]) => void
  /** In the capture bar's drawer: no divider line above. */
  bare?: boolean
}) {
  const c = useColors()
  const { data = [] } = useAttachments(itemType, id)
  const [problems, setProblems] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const { images, files } = splitMedia(data)
  const toggle = (attachmentId: string) =>
    onRemoved(removed.includes(attachmentId) ? removed.filter((r) => r !== attachmentId) : [...removed, attachmentId])

  const pick = async (how: () => Promise<Picked | null>) => {
    if (picking) return
    setPicking(true)
    setProblems([])
    try {
      const picked = await how()
      if (!picked) return
      setProblems(picked.problems)
      if (picked.added.length) onPending((p) => [...p, ...picked.added])
    } catch (err) {
      setProblems([err instanceof Error ? err.message : t('common.error')])
    } finally {
      setPicking(false)
    }
  }

  const pendingImages = pending.filter((p) => p.isImage)
  const pendingFiles = pending.filter((p) => !p.isImage)
  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; run: () => Promise<Picked | null> }[] = [
    { icon: 'camera-outline', label: t('media.takePhoto'), run: () => pickPhotos(true) },
    { icon: 'image-outline', label: t('media.addImage'), run: () => pickPhotos(false) },
    { icon: 'attach-outline', label: t('media.addFile'), run: pickDocuments },
  ]

  return (
    <View style={[styles.section, { borderTopColor: c.border }, bare && { borderTopWidth: 0, paddingTop: 0 }]}>
      <View style={styles.head}>
        <Ionicons name="images-outline" size={18} color={c.text} />
        <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{t('media.title')}</Text>
        {picking && <ActivityIndicator size="small" color={c.muted} />}
      </View>
      {(images.length > 0 || pendingImages.length > 0) && (
        <Grid>
          {(size) => (
            <>
              {images.map((a) => {
                const gone = removed.includes(a.id)
                return (
                  <View key={a.id} style={[styles.thumb, { width: size, height: size, borderColor: c.border, backgroundColor: c.surface2 }]}>
                    <View style={[StyleSheet.absoluteFill, gone && { opacity: 0.3 }]}>
                      <StoredImage id={a.id} />
                    </View>
                    <RemoveToggle removed={gone} onPress={() => toggle(a.id)} />
                  </View>
                )
              })}
              {pendingImages.map((p) => (
                <View
                  key={p.key}
                  style={[styles.thumb, styles.pending, { width: size, height: size, borderColor: c.accent }]}
                  accessibilityLabel={t('media.pending')}>
                  <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <RemoveToggle removed={false} onPress={() => onPending((list) => list.filter((x) => x.key !== p.key))} />
                </View>
              ))}
            </>
          )}
        </Grid>
      )}
      {files.map((a) => (
        <FileRow key={a.id} attachment={a} removed={removed.includes(a.id)} onToggle={() => toggle(a.id)} />
      ))}
      {pendingFiles.map((p) => (
        <View key={p.key} style={styles.fileRow}>
          <View style={[styles.file, styles.pending, { borderColor: c.accent, backgroundColor: c.surface }]}>
            <Ionicons name="document-text-outline" size={20} color={c.muted} />
            <Text style={[styles.fileName, { color: c.text }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{t('media.pending')}</Text>
          </View>
          <RemoveToggle removed={false} onPress={() => onPending((list) => list.filter((x) => x.key !== p.key))} onCard />
        </View>
      ))}
      {problems.map((p) => (
        <Text key={p} style={{ color: c.danger }}>
          {p}
        </Text>
      ))}
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => void pick(a.run)}
            disabled={picking}
            style={({ pressed }) => [styles.chip, { borderColor: c.border, backgroundColor: c.surface, opacity: picking ? 0.5 : pressed ? 0.7 : 1 }]}
            accessibilityRole="button">
            <Ionicons name={a.icon} size={16} color={c.text} />
            <Text style={{ color: c.text }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  section: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  thumb: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  pending: { borderWidth: 2, borderStyle: 'dashed' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  removeOnImage: { position: 'absolute', top: 4, end: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  file: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  fileName: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  viewerClose: { position: 'absolute', end: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  viewerCount: { position: 'absolute', alignSelf: 'center', color: '#fff', fontSize: 14 },
  viewerCaption: {
    position: 'absolute',
    start: 16,
    end: 16,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
})
