import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useListing } from '@/hooks/useListing'
import { useCategories } from '@/hooks/useListings'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

const MAX_IMAGES = 5

// An image is either already saved remotely (url) or a new local pick (uri)
type ImageItem =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; uri: string }

interface FormData {
  title: string
  description: string
  price: string
  category_id: string
  stock_qty: string
  location: string
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const { data: listing, isLoading: loadingListing } = useListing(id)
  const { data: categories } = useCategories()
  const queryClient = useQueryClient()

  const [initialised, setInitialised] = useState(false)
  const [images, setImages] = useState<ImageItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData & { images: string }>>({})
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    price: '',
    category_id: '',
    stock_qty: '1',
    location: '',
  })

  // Seed form once the listing loads
  if (!initialised && listing) {
    setForm({
      title: listing.title,
      description: listing.description ?? '',
      price: String(listing.price_zmw),
      category_id: listing.category_id ?? '',
      stock_qty: String(listing.stock_qty),
      location: listing.location ?? '',
    })
    setImages((listing.images ?? []).map(url => ({ kind: 'remote', url })))
    setInitialised(true)
  }

  const set = (key: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  // ── Image handling ──────────────────────────────────────────

  const pickImage = async (source: 'camera' | 'library') => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Max images', `You can only have up to ${MAX_IMAGES} photos.`)
      return
    }

    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert('Permission required', `Allow Gula to access your ${source === 'camera' ? 'camera' : 'photos'}.`)
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: MAX_IMAGES - images.length,
          quality: 0.9,
        })

    if (result.canceled) return

    setUploading(true)
    setErrors(e => ({ ...e, images: undefined }))

    const newItems: ImageItem[] = []
    for (const asset of result.assets) {
      const url = await uploadImage(asset.uri)
      if (url) newItems.push({ kind: 'remote', url })
    }

    setImages(prev => [...prev, ...newItems].slice(0, MAX_IMAGES))
    setUploading(false)
  }

  const uploadImage = async (uri: string): Promise<string | null> => {
    if (!session?.user) return null
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )
      const response = await fetch(compressed.uri)
      const arrayBuffer = await response.arrayBuffer()
      const filePath = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`

      const { error } = await supabase.storage
        .from('listings')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg' })

      if (error) throw error

      const { data } = supabase.storage.from('listings').getPublicUrl(filePath)
      return data.publicUrl
    } catch {
      return null
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  // ── Validation & save ───────────────────────────────────────

  const validate = () => {
    const e: typeof errors = {}
    if (!form.title.trim()) e.title = 'Enter a title'
    if (!form.category_id) e.category_id = 'Select a category'
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) < 1)
      e.price = 'Enter a valid price (min K1)'
    if (!form.location.trim()) e.location = 'Enter your location'
    if (images.length === 0) e.images = 'Add at least one photo'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate() || !listing) return
    setSaving(true)

    const finalImages = images.map(img => img.kind === 'remote' ? img.url : '')
      .filter(Boolean)

    const { error } = await supabase
      .from('listings')
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_zmw: Number(form.price),
        category_id: form.category_id,
        images: finalImages,
        stock_qty: Number(form.stock_qty) || 1,
        location: form.location.trim(),
      })
      .eq('id', listing.id)

    setSaving(false)

    if (error) {
      Alert.alert('Error', 'Could not save changes. Please try again.')
      return
    }

    // Invalidate so listing detail + seller dashboard refresh
    queryClient.invalidateQueries({ queryKey: ['listing', listing.id] })
    queryClient.invalidateQueries({ queryKey: ['seller-listings'] })
    queryClient.invalidateQueries({ queryKey: ['listings'] })

    router.back()
  }

  if (loadingListing || !initialised) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.black} size="large" />
      </View>
    )
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit listing</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Photos ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Photos</Text>
          <Text style={styles.fieldNote}>First photo is the cover. Up to {MAX_IMAGES}.</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesRow}
          >
            {images.map((img, i) => {
              const uri = img.kind === 'remote' ? img.url : img.uri
              return (
                <View key={`${uri}-${i}`} style={styles.imageTile}>
                  <Image source={{ uri }} style={styles.imageTileImg} />
                  {i === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeTile} onPress={() => removeImage(i)}>
                    <Feather name="x" size={10} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              )
            })}

            {uploading && (
              <View style={[styles.imageTile, styles.imageTileLoading]}>
                <ActivityIndicator color={Colors.textSecondary} />
              </View>
            )}

            {!uploading && images.length < MAX_IMAGES && (
              <View style={styles.addButtons}>
                <TouchableOpacity style={styles.addBtn} onPress={() => pickImage('camera')}>
                  <Feather name="camera" size={22} color={Colors.gray400} />
                  <Text style={styles.addBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => pickImage('library')}>
                  <Feather name="image" size={22} color={Colors.gray400} />
                  <Text style={styles.addBtnText}>Library</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {errors.images ? <Text style={styles.errorText}>{errors.images}</Text> : null}
        </View>

        {/* ── Title ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={[styles.input, errors.title ? styles.inputError : null]}
            placeholder="e.g. Samsung Galaxy A54 — 128GB"
            placeholderTextColor={Colors.textDisabled}
            value={form.title}
            onChangeText={t => set('title', t)}
            maxLength={80}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        {/* ── Category ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories?.map(cat => {
              const selected = form.category_id === cat.id
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => set('category_id', cat.id)}
                >
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          {errors.category_id ? <Text style={styles.errorText}>{errors.category_id}</Text> : null}
        </View>

        {/* ── Price + Stock ── */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Price (ZMW)</Text>
            <View style={[styles.inputWrap, errors.price ? styles.inputError : null]}>
              <Text style={styles.inputPrefix}>K</Text>
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.inputInner}
                placeholder="0"
                placeholderTextColor={Colors.textDisabled}
                value={form.price}
                onChangeText={t => set('price', t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}
          </View>

          <View style={[styles.field, { width: 110 }]}>
            <Text style={styles.label}>Stock qty</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={Colors.textDisabled}
              value={form.stock_qty}
              onChangeText={t => set('stock_qty', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* ── Description ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.textarea}
            placeholder="Describe the condition, what's included, any defects..."
            placeholderTextColor={Colors.textDisabled}
            value={form.description}
            onChangeText={t => set('description', t)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Location ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Your location</Text>
          <TextInput
            style={[styles.input, errors.location ? styles.inputError : null]}
            placeholder="e.g. Lusaka, Kabulonga"
            placeholderTextColor={Colors.textDisabled}
            value={form.location}
            onChangeText={t => set('location', t)}
            autoCapitalize="words"
          />
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
        </View>

        {/* ── Save ── */}
        <TouchableOpacity
          style={[styles.saveBtn, (saving || uploading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || uploading}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { ...Type.labelLg, color: Colors.textSecondary, fontFamily: Fonts.medium, width: 48 },
  headerTitle: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.bold },
  scroll: { padding: 24, gap: 24, paddingBottom: 48 },
  field: { gap: 8 },
  label: { ...Type.labelMd, color: Colors.textPrimary },
  optional: { fontFamily: Fonts.regular, color: Colors.textDisabled },
  fieldNote: { ...Type.caption, color: Colors.textDisabled, marginTop: -4 },
  errorText: { ...Type.bodySm, color: Colors.error },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    height: 52, paddingHorizontal: 16, ...Type.bodyLg,
    color: Colors.textPrimary, fontFamily: Fonts.regular,
  },
  inputError: { borderColor: Colors.error },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    height: 52, paddingHorizontal: 16,
  },
  inputPrefix: { ...Type.bodyLg, color: Colors.textSecondary, fontFamily: Fonts.medium },
  inputDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 10 },
  inputInner: { flex: 1, ...Type.bodyLg, color: Colors.textPrimary, fontFamily: Fonts.regular },
  textarea: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    minHeight: 100, padding: 16, ...Type.bodyLg,
    color: Colors.textPrimary, fontFamily: Fonts.regular,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  imagesRow: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  imageTile: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.gray100 },
  imageTileLoading: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  imageTileImg: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: Colors.black, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  coverBadgeText: { fontFamily: Fonts.medium, fontSize: 10, color: Colors.white },
  removeTile: {
    position: 'absolute', top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  addButtons: { flexDirection: 'row', gap: 10 },
  addBtn: {
    width: 100, height: 100, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.gray50,
  },
  addBtnText: { ...Type.labelSm, color: Colors.textSecondary, fontFamily: Fonts.medium },
  categoryRow: { gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  categoryChipSelected: { backgroundColor: Colors.black, borderColor: Colors.black },
  categoryChipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  categoryChipTextSelected: { color: Colors.white },
  saveBtn: {
    backgroundColor: Colors.black, borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...Type.labelLg, color: Colors.white, fontFamily: Fonts.bold },
})
