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
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

type IdType = 'nrc' | 'passport' | 'driver_license'
type MomoProvider = 'mtn' | 'airtel'

interface FormData {
  seller_name: string
  description: string
  location: string
  id_type: IdType
  id_number: string
  mobile_money_provider: MomoProvider
  mobile_money_number: string
}

const TOTAL_STEPS = 3

export default function SellerApplyScreen() {
  const { session, fetchProfile } = useAuthStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData & { id_document: string }>>({})

  const [form, setForm] = useState<FormData>({
    seller_name: '',
    description: '',
    location: '',
    id_type: 'nrc',
    id_number: '',
    mobile_money_provider: 'mtn',
    mobile_money_number: '',
  })

  // ID document — local URI before upload, storage path after
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null)
  const [idDocumentUploading, setIdDocumentUploading] = useState(false)
  const [idDocumentPath, setIdDocumentPath] = useState<string | null>(null)

  const set = (key: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const pickDocument = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        `Please allow Gula to access your ${source === 'camera' ? 'camera' : 'photo library'}.`
      )
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, base64: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setIdDocumentUri(asset.uri)
    setErrors(e => ({ ...e, id_document: undefined }))
    uploadDocument(asset.uri)
  }

  const uploadDocument = async (uri: string) => {
    if (!session?.user) return
    setIdDocumentUploading(true)
    setIdDocumentPath(null)

    try {
      // Compress and resize — ID docs don't need to be huge
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )

      const response = await fetch(compressed.uri)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      const filePath = `${session.user.id}/${Date.now()}.jpg`

      const { error } = await supabase.storage
        .from('id-documents')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (error) throw error
      setIdDocumentPath(filePath)
    } catch {
      setIdDocumentUri(null)
      Alert.alert('Upload failed', 'Could not upload your document. Please try again.')
    } finally {
      setIdDocumentUploading(false)
    }
  }

  const validateStep = () => {
    const e: typeof errors = {}
    if (step === 1) {
      if (!form.seller_name.trim()) e.seller_name = 'Enter your shop name'
      if (!form.description.trim() || form.description.trim().length < 10)
        e.description = 'Describe what you sell (at least 10 characters)'
      if (!form.location.trim()) e.location = 'Enter your location'
    }
    if (step === 2) {
      if (!form.id_number.trim()) e.id_number = 'Enter your ID number'
      if (!idDocumentPath) e.id_document = 'Upload a photo of your ID document'
    }
    if (step === 3) {
      const digits = form.mobile_money_number.replace(/\D/g, '')
      if (digits.length < 9) e.mobile_money_number = 'Enter a valid mobile number'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (!validateStep()) return
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }
    handleSubmit()
  }

  const handleSubmit = async () => {
    if (!session?.user) return
    setLoading(true)

    const digits = form.mobile_money_number.replace(/\D/g, '')
    const formatted = digits.startsWith('260') ? `+${digits}`
      : digits.startsWith('0') ? `+260${digits.slice(1)}`
      : `+260${digits}`

    const { error: insertError } = await supabase
      .from('seller_applications')
      .insert({
        user_id: session.user.id,
        seller_name: form.seller_name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        id_type: form.id_type,
        id_number: form.id_number.trim(),
        id_document_url: idDocumentPath,
        mobile_money_provider: form.mobile_money_provider,
        mobile_money_number: formatted,
      })

    if (insertError) {
      setLoading(false)
      if (insertError.code === '23505') { router.back(); return }
      return
    }

    await supabase
      .from('profiles')
      .update({ seller_status: 'pending' })
      .eq('id', session.user.id)

    await fetchProfile(session.user.id)
    setLoading(false)
    router.back()
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apply to sell</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && <StepShopInfo form={form} errors={errors} set={set} />}
        {step === 2 && (
          <StepIdentity
            form={form}
            errors={errors}
            set={set}
            idDocumentUri={idDocumentUri}
            idDocumentUploading={idDocumentUploading}
            idDocumentPath={idDocumentPath}
            onPickDocument={pickDocument}
          />
        )}
        {step === 3 && <StepPayout form={form} errors={errors} set={set} />}

        <TouchableOpacity
          style={[styles.button, (loading || idDocumentUploading) && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={loading || idDocumentUploading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.buttonText}>
                {step < TOTAL_STEPS ? 'Continue' : 'Submit application'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.stepIndicator}>{step} of {TOTAL_STEPS}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Step 1: Shop info ────────────────────────────────────────

function StepShopInfo({ form, errors, set }: StepProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>About your shop</Text>
      <Text style={styles.stepSubtitle}>This is what buyers will see when they view your listings.</Text>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Shop name</Text>
          <TextInput
            style={[styles.input, errors.seller_name ? styles.inputError : null]}
            placeholder="e.g. Mwila's Electronics"
            placeholderTextColor={Colors.textDisabled}
            value={form.seller_name}
            onChangeText={(t) => set('seller_name', t)}
            autoCapitalize="words"
            autoFocus
          />
          {errors.seller_name ? <Text style={styles.errorText}>{errors.seller_name}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>What do you sell?</Text>
          <TextInput
            style={[styles.textarea, errors.description ? styles.inputError : null]}
            placeholder="Describe the kinds of products you sell..."
            placeholderTextColor={Colors.textDisabled}
            value={form.description}
            onChangeText={(t) => set('description', t)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Your location</Text>
          <TextInput
            style={[styles.input, errors.location ? styles.inputError : null]}
            placeholder="e.g. Lusaka, Woodlands"
            placeholderTextColor={Colors.textDisabled}
            value={form.location}
            onChangeText={(t) => set('location', t)}
            autoCapitalize="words"
          />
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
        </View>
      </View>
    </View>
  )
}

// ─── Step 2: Identity ─────────────────────────────────────────

const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'nrc', label: 'NRC' },
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: "Driver's" },
]

interface StepIdentityProps extends StepProps {
  idDocumentUri: string | null
  idDocumentUploading: boolean
  idDocumentPath: string | null
  onPickDocument: (source: 'camera' | 'library') => void
}

function StepIdentity({
  form, errors, set,
  idDocumentUri, idDocumentUploading, idDocumentPath, onPickDocument,
}: StepIdentityProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>Verify your identity</Text>
      <Text style={styles.stepSubtitle}>
        Used for admin vetting only. Never shown to buyers.
      </Text>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>ID type</Text>
          <View style={styles.segmented}>
            {ID_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.segment, form.id_type === t.value && styles.segmentSelected]}
                onPress={() => set('id_type', t.value)}
              >
                <Text style={[styles.segmentText, form.id_type === t.value && styles.segmentTextSelected]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ID number</Text>
          <TextInput
            style={[styles.input, errors.id_number ? styles.inputError : null]}
            placeholder={form.id_type === 'nrc' ? 'e.g. 123456/78/9' : 'ID number'}
            placeholderTextColor={Colors.textDisabled}
            value={form.id_number}
            onChangeText={(t) => set('id_number', t)}
            autoCapitalize="characters"
          />
          {errors.id_number ? <Text style={styles.errorText}>{errors.id_number}</Text> : null}
        </View>

        {/* Document upload */}
        <View style={styles.field}>
          <Text style={styles.label}>Photo of your ID document</Text>
          <Text style={styles.fieldNote}>
            Take a clear photo or upload a scan. All pages must be visible.
          </Text>

          {/* Preview */}
          {idDocumentUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: idDocumentUri }} style={styles.preview} resizeMode="cover" />
              {idDocumentUploading ? (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator color={Colors.white} />
                  <Text style={styles.previewOverlayText}>Uploading...</Text>
                </View>
              ) : idDocumentPath ? (
                <View style={[styles.previewOverlay, styles.previewOverlaySuccess]}>
                  <Text style={styles.previewOverlayText}>✓ Uploaded</Text>
                </View>
              ) : null}
              {/* Retake button */}
              {!idDocumentUploading && (
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => onPickDocument('camera')}
                >
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.uploadBox, errors.id_document ? styles.uploadBoxError : null]}>
              <Text style={styles.uploadBoxIcon}>⊡</Text>
              <Text style={styles.uploadBoxTitle}>Add a photo</Text>
              <Text style={styles.uploadBoxSubtitle}>Clear, well-lit, all edges visible</Text>
              <View style={styles.uploadActions}>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => onPickDocument('camera')}
                >
                  <Text style={styles.uploadBtnText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadBtn, styles.uploadBtnSecondary]}
                  onPress={() => onPickDocument('library')}
                >
                  <Text style={[styles.uploadBtnText, styles.uploadBtnTextSecondary]}>
                    Choose from library
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {errors.id_document ? (
            <Text style={styles.errorText}>{errors.id_document}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Your ID details and document are stored securely and only accessed by our team during vetting.
        </Text>
      </View>
    </View>
  )
}

// ─── Step 3: Payout ───────────────────────────────────────────

const PROVIDERS: { value: MomoProvider; label: string; color: string }[] = [
  { value: 'mtn', label: 'MTN Money', color: '#FFCC00' },
  { value: 'airtel', label: 'Airtel Money', color: '#FF0000' },
]

function StepPayout({ form, errors, set }: StepProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>Payout details</Text>
      <Text style={styles.stepSubtitle}>
        Where we send your money when a sale completes.
      </Text>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Mobile money provider</Text>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.providerCard,
                  form.mobile_money_provider === p.value && styles.providerCardSelected,
                ]}
                onPress={() => set('mobile_money_provider', p.value)}
                activeOpacity={0.8}
              >
                <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                <Text style={[
                  styles.providerLabel,
                  form.mobile_money_provider === p.value && styles.providerLabelSelected,
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mobile money number</Text>
          <View style={[styles.inputWrap, errors.mobile_money_number ? styles.inputWrapError : null]}>
            <Text style={styles.prefix}>+260</Text>
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.inputInner}
              placeholder="97 123 4567"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="phone-pad"
              value={form.mobile_money_number}
              onChangeText={(t) => set('mobile_money_number', t)}
              maxLength={15}
            />
          </View>
          {errors.mobile_money_number
            ? <Text style={styles.errorText}>{errors.mobile_money_number}</Text>
            : null
          }
          <Text style={styles.fieldNote}>
            Must be the {form.mobile_money_provider.toUpperCase()} number registered to your account.
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Types ────────────────────────────────────────────────────

interface StepProps {
  form: FormData
  errors: Partial<FormData & { id_document: string }>
  set: (key: keyof FormData, value: string) => void
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backText: {
    ...Type.labelLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
    width: 48,
  },
  headerTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.gray100,
    marginHorizontal: 24,
    borderRadius: 1,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.black,
    borderRadius: 1,
  },
  scroll: {
    padding: 28,
    paddingTop: 32,
    gap: 24,
  },
  step: {
    gap: 4,
  },
  stepTitle: {
    ...Type.h2,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  fields: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    ...Type.labelMd,
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
  },
  textarea: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    minHeight: 100,
    padding: 16,
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Type.bodySm,
    color: Colors.error,
  },
  fieldNote: {
    ...Type.caption,
    color: Colors.textDisabled,
  },
  // Document upload
  uploadBox: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gray50,
  },
  uploadBoxError: {
    borderColor: Colors.error,
  },
  uploadBoxIcon: {
    fontSize: 32,
    color: Colors.gray400,
    lineHeight: 40,
    marginBottom: 4,
  },
  uploadBoxTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  uploadBoxSubtitle: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadActions: {
    gap: 10,
    width: '100%',
  },
  uploadBtn: {
    backgroundColor: Colors.black,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  uploadBtnText: {
    ...Type.labelMd,
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  uploadBtnTextSecondary: {
    color: Colors.textPrimary,
  },
  // Preview
  previewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    height: 200,
    backgroundColor: Colors.gray100,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  previewOverlaySuccess: {
    backgroundColor: 'rgba(22,163,74,0.75)',
  },
  previewOverlayText: {
    ...Type.labelMd,
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  retakeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeText: {
    ...Type.labelSm,
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  // Segmented
  segmented: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  segmentSelected: {
    backgroundColor: Colors.black,
  },
  segmentText: {
    ...Type.labelMd,
    color: Colors.textSecondary,
  },
  segmentTextSelected: {
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  // Provider
  providerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  providerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: Colors.white,
  },
  providerCardSelected: {
    borderColor: Colors.black,
    backgroundColor: Colors.gray50,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerLabel: {
    ...Type.labelMd,
    color: Colors.textSecondary,
  },
  providerLabelSelected: {
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  // Phone input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapError: {
    borderColor: Colors.error,
  },
  prefix: {
    ...Type.bodyLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  inputInner: {
    flex: 1,
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
  },
  // Info card
  infoCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  // Bottom
  button: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  stepIndicator: {
    ...Type.caption,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
})
