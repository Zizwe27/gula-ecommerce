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
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useListing } from '@/hooks/useListing'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

type PaymentProvider = 'mtn' | 'airtel'

export default function NewOrderScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>()
  const { data: listing, isLoading } = useListing(listingId)
  const { profile } = useAuthStore()
  const insets = useSafeAreaInsets()

  const [address, setAddress] = useState(profile?.location ?? '')
  const [provider, setProvider] = useState<PaymentProvider>('mtn')
  const [mobileNumber, setMobileNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ address?: string; mobileNumber?: string }>({})

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.black} size="large" />
      </View>
    )
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Listing not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!address.trim()) e.address = 'Please enter a delivery address'
    if (!mobileNumber.trim()) e.mobileNumber = 'Please enter your mobile money number'
    else if (!/^[79]\d{8}$/.test(mobileNumber.trim()))
      e.mobileNumber = 'Enter a valid number (e.g. 971234567)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePlaceOrder = async () => {
    if (!validate()) return
    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          listing_id: listing.id,
          buyer_id: profile!.id,
          seller_id: listing.seller_id,
          qty: 1,
          listing_title: listing.title,
          listing_image: listing.images?.[0] ?? null,
          unit_price_zmw: listing.price_zmw,
          total_zmw: listing.price_zmw,
          delivery_address: address.trim(),
          payment_provider: provider,
          payment_reference: `+260${mobileNumber.trim()}`,
          status: 'pending_payment',
        })
        .select()
        .single()

      if (error) throw error

      router.replace(`/(app)/order/${data.id}`)
    } catch (err: any) {
      Alert.alert('Could not place order', err.message ?? 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const thumb = listing.images?.[0]

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Place order</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Item summary */}
        <View style={styles.itemCard}>
          <Image
            source={thumb ? { uri: thumb } : require('@/assets/listing-placeholder.png')}
            style={styles.itemThumb}
            contentFit="cover"
          />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>{listing.title}</Text>
            <Text style={styles.itemSeller}>
              {listing.seller?.shop_name ?? listing.seller?.display_name}
            </Text>
          </View>
          <Text style={styles.itemPrice}>K {Number(listing.price_zmw).toLocaleString()}</Text>
        </View>

        {/* Delivery address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Delivery address</Text>
          <TextInput
            style={[styles.input, errors.address && styles.inputError]}
            value={address}
            onChangeText={(v) => { setAddress(v); setErrors(e => ({ ...e, address: undefined })) }}
            placeholder="Area, street or landmark"
            placeholderTextColor={Colors.textDisabled}
            returnKeyType="next"
          />
          {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
          <Text style={styles.fieldHint}>Used for record only — you arrange handoff with the seller directly.</Text>
        </View>

        {/* Payment method */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Payment method</Text>
          <View style={styles.providerRow}>
            {([
              { id: 'mtn' as PaymentProvider, label: 'MTN MoMo', color: '#FFC107' },
              { id: 'airtel' as PaymentProvider, label: 'Airtel Money', color: '#E00000' },
            ]).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerCard, provider === p.id && styles.providerCardSelected]}
                onPress={() => setProvider(p.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                <Text style={[styles.providerLabel, provider === p.id && styles.providerLabelSelected]}>
                  {p.label}
                </Text>
                <View style={[styles.radio, provider === p.id && styles.radioSelected]}>
                  {provider === p.id && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mobile number */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Mobile money number</Text>
          <View style={[styles.phoneRow, errors.mobileNumber && styles.inputError]}>
            <Text style={styles.phonePrefix}>+260</Text>
            <View style={styles.phoneDivider} />
            <TextInput
              style={styles.phoneInput}
              value={mobileNumber}
              onChangeText={(v) => { setMobileNumber(v); setErrors(e => ({ ...e, mobileNumber: undefined })) }}
              placeholder="971234567"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="phone-pad"
              maxLength={9}
            />
          </View>
          {errors.mobileNumber ? <Text style={styles.errorText}>{errors.mobileNumber}</Text> : null}
          <Text style={styles.fieldHint}>
            Funds are held in escrow until you confirm delivery.
          </Text>
        </View>

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Item</Text>
            <Text style={styles.summaryVal}>K {Number(listing.price_zmw).toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Platform fee</Text>
            <Text style={styles.summaryVal}>K 0 <Text style={styles.summaryFree}>(free in beta)</Text></Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalKey}>Total</Text>
            <Text style={styles.summaryTotalVal}>K {Number(listing.price_zmw).toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, submitting && styles.ctaBtnDisabled]}
          onPress={handlePlaceOrder}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <View style={styles.ctaBtnInner}>
              <View>
                <Text style={styles.ctaBtnLabel}>Pay with {provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}</Text>
                <Text style={styles.ctaBtnPrice}>K {Number(listing.price_zmw).toLocaleString()}</Text>
              </View>
              <Feather name="arrow-right" size={22} color={Colors.white} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.white,
  },
  notFoundText: { ...Type.h3, color: Colors.textPrimary },
  backLink: { ...Type.bodyMd, color: Colors.textSecondary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Type.h3,
    color: Colors.textPrimary,
  },

  content: {
    padding: 20,
    gap: 24,
  },

  // Item card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  itemThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  itemSeller: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionLabel: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Type.bodySm,
    color: Colors.error,
  },
  fieldHint: {
    ...Type.caption,
    color: Colors.textDisabled,
    lineHeight: 16,
  },

  // Provider
  providerRow: {
    gap: 10,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  providerCardSelected: {
    borderColor: Colors.black,
    backgroundColor: Colors.gray50,
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  providerLabel: {
    flex: 1,
    ...Type.bodyLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
  },
  providerLabelSelected: {
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.black },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.black,
  },

  // Phone input
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  phonePrefix: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
  },

  // Summary
  summaryCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    ...Type.labelMd,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryKey: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  summaryVal: {
    ...Type.bodyMd,
    color: Colors.textPrimary,
  },
  summaryFree: {
    color: Colors.success,
    fontSize: 12,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: -2,
  },
  summaryTotalKey: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  summaryTotalVal: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    backgroundColor: Colors.black,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  ctaBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
  ctaBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  ctaBtnLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 1,
  },
  ctaBtnPrice: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.white,
    letterSpacing: -0.3,
  },
})
