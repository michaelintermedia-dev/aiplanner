import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { formatSize, splitMedia } from '@shared/media'
import type { Attachment, ItemType } from '@shared/types'
import { Image } from 'expo-image'
import { useCallback, useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, I18nManager, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { attachmentSource, openAttachment, pickDocuments, pickPhotos, shareAttachments, useAttachments, type Picked, type PendingMedia } from '@/lib/media'
import { useColors } from '@/theme'
import { useCardStyle } from './panel'
import { ZoomableImage } from './ZoomableImage'

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

/**
 * The item's photos and documents, on its screen (nothing when it has none). Same as the web's.
 * Select (2 or more) picks several to share at once (user's request, 2026-11-09).
 */
export function ItemMedia({ itemType, id }: { itemType: ItemType; id: string }) {
  const c = useColors()
  const { data } = useAttachments(itemType, id)
  const flat = useCardStyle()
  const [open, setOpen] = useState<number | null>(null)
  // null = not selecting; otherwise the picked attachment ids.
  const [picked, setPicked] = useState<string[] | null>(null)
  const [sharing, setSharing] = useState(false)
  if (!data?.length) return null
  const { images, files } = splitMedia(data)
  const toggle = (aid: string) => setPicked((p) => (p ? (p.includes(aid) ? p.filter((x) => x !== aid) : [...p, aid]) : p))
  const share = async () => {
    if (!picked?.length) return
    setSharing(true)
    try {
      await shareAttachments(data.filter((a) => picked.includes(a.id)))
      setPicked(null)
    } catch {
      // cancelled or offline: stay in Select
    } finally {
      setSharing(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, flat]}>
      <View style={styles.head}>
        <Ionicons name="images-outline" size={14} color={c.muted} />
        <Text style={[styles.heading, { color: c.muted, flex: 1 }]}>{t('media.title').toUpperCase()}</Text>
        {data.length > 1 && !picked && (
          <Pressable onPress={() => setPicked([])} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: c.accent, fontWeight: '600' }}>{t('select.start')}</Text>
          </Pressable>
        )}
      </View>
      {images.length > 0 && (
        <Grid>
          {(size) =>
            images.map((a, i) => {
              const on = picked?.includes(a.id) ?? false
              return (
                <Pressable
                  key={a.id}
                  onPress={() => (picked ? toggle(a.id) : setOpen(i))}
                  style={[
                    styles.thumb,
                    { width: size, height: size, borderColor: on ? c.accent : c.border, backgroundColor: c.surface2 },
                    on && styles.thumbPicked,
                  ]}
                  accessibilityRole={picked ? 'checkbox' : 'imagebutton'}
                  accessibilityState={picked ? { checked: on } : undefined}
                  accessibilityLabel={picked ? t('select.item', { title: a.fileName }) : t('media.open', { name: a.fileName })}>
                  <StoredImage id={a.id} />
                  {picked && (
                    <View style={styles.check}>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? c.accent : '#fff'} />
                    </View>
                  )}
                </Pressable>
              )
            })
          }
        </Grid>
      )}
      {files.map((a) =>
        picked ? (
          <Pressable
            key={a.id}
            onPress={() => toggle(a.id)}
            style={[styles.file, { borderColor: picked.includes(a.id) ? c.accent : c.border, backgroundColor: picked.includes(a.id) ? c.accentSoft : c.surface }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: picked.includes(a.id) }}>
            <Ionicons name={picked.includes(a.id) ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={c.accent} />
            <Text style={{ color: c.text, flex: 1 }} numberOfLines={1}>
              {a.fileName}
            </Text>
          </Pressable>
        ) : (
          <FileRow key={a.id} attachment={a} />
        ),
      )}
      {picked && (
        <View style={styles.selectBar}>
          <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{t('select.count', { count: picked.length })}</Text>
          <Pressable onPress={() => setPicked(null)} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: c.muted }}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void share()}
            disabled={!picked.length || sharing}
            style={[styles.shareButton, { backgroundColor: c.accent, opacity: !picked.length || sharing ? 0.5 : 1 }]}
            accessibilityRole="button">
            {sharing ? <ActivityIndicator size="small" color={c.accentText} /> : <Ionicons name="share-social-outline" size={18} color={c.accentText} />}
            <Text style={{ color: c.accentText, fontWeight: '600' }}>{t('media.share')}</Text>
          </Pressable>
        </View>
      )}
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

/**
 * The pictures full screen, swiping between them. Pinch / double-tap to zoom
 * (ZoomableImage); a tap hides or shows the controls; the description only
 * when asked for (the i button) - it used to cover the picture (2026-10-27).
 */
function Viewer({ images, index, onClose }: { images: Attachment[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [at, setAt] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [info, setInfo] = useState(false)
  const toggleChrome = useCallback(() => setChrome((c) => !c), [])
  const description = images[at]?.description
  // Share the picture to another app (user's request, 2026-11-09): the same share sheet documents use.
  const [sharing, setSharing] = useState(false)
  const share = async () => {
    const a = images[at]
    if (!a || sharing) return
    setSharing(true)
    try {
      await openAttachment(a)
    } catch {
      // cancelled or offline: nothing to do
    } finally {
      setSharing(false)
    }
  }
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.viewer}>
        {index !== null && (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            inverted={I18nManager.isRTL}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
            onLayout={() => setAt(index)}
            renderItem={({ item }) => (
              <View style={{ width, height, overflow: 'hidden' }} accessibilityLabel={item.description ?? item.fileName}>
                <ZoomableImage width={width} height={height} onZoomChange={setZoomed} onTap={toggleChrome}>
                  <StoredImage id={item.id} fit="contain" />
                </ZoomableImage>
              </View>
            )}
          />
        )}
        {chrome && (
          <>
            <Pressable
              onPress={onClose}
              style={[styles.viewerClose, { top: insets.top + 12 }]}
              accessibilityRole="button"
              accessibilityLabel={t('media.close')}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => void share()}
              disabled={sharing}
              style={[styles.viewerClose, styles.viewerShare, { top: insets.top + 12 }]}
              accessibilityRole="button"
              accessibilityLabel={t('media.share')}>
              {sharing ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-social-outline" size={24} color="#fff" />}
            </Pressable>
            {!!description && (
              <Pressable
                onPress={() => setInfo((i) => !i)}
                style={[styles.viewerInfo, { bottom: insets.bottom + 12 }, info && styles.viewerInfoOn]}
                accessibilityRole="button"
                accessibilityState={{ expanded: info }}
                accessibilityLabel={t('media.description')}>
                <Ionicons name={info ? 'information-circle' : 'information-circle-outline'} size={26} color="#fff" />
              </Pressable>
            )}
            {info && !!description && (
              <ScrollView style={[styles.viewerCaption, { bottom: insets.bottom + 68, maxHeight: height * 0.4 }]}>
                <Text style={styles.viewerCaptionText}>{description}</Text>
              </ScrollView>
            )}
            {images.length > 1 && (
              <Text style={[styles.viewerCount, { bottom: insets.bottom + 22 }]}>
                {at + 1} / {images.length}
              </Text>
            )}
          </>
        )}
      </GestureHandlerRootView>
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
  viewerShare: { end: 64 },
  thumbPicked: { borderWidth: 3 },
  check: { position: 'absolute', top: 6, end: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
  selectBar: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  viewerCount: { position: 'absolute', alignSelf: 'center', color: '#fff', fontSize: 14 },
  viewerInfo: { position: 'absolute', end: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  viewerInfoOn: { backgroundColor: 'rgba(255,255,255,0.3)' },
  viewerCaptionText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  viewerCaption: {
    position: 'absolute',
    start: 16,
    end: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
})
