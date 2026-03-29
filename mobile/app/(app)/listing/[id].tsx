import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native'
import { useState, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useListing } from '@/hooks/useListing'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GALLERY_HEIGHT = SCREEN_WIDTH * 0.72

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: listing, isLoading } = useListing(id)
  const { profile } = useAuthStore()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [activeImage, setActiveImage] = useState(0)
  const galleryRef = useRef<ScrollView>(null)

  // Seller controls state
  const [stockQty, setStockQty] = useState<number | null>(null)
  const [savingStock, setSavingStock] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [removing, setRemoving] = useState(false)

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setActiveImage(index)
  }

  if (isLoading) return <LoadingScreen />
  if (!listing) return <NotFoundScreen />

  // Seed local stock qty from listing on first render
  const currentStock = stockQty ?? listing.stock_qty

  const images = listing.images?.length > 0 ? listing.images : [null]
  const sellerName = listing.seller?.shop_name || listing.seller?.display_name || 'Seller'
  const isOwnListing = profile?.id === listing.seller_id
  const inStock = listing.stock_qty > 0

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listing', listing.id] })
    queryClient.invalidateQueries({ queryKey: ['seller-listings'] })
    queryClient.invalidateQueries({ queryKey: ['listings'] })
  }

  // ── Seller actions ──────────────────────────────────────────

  const handleSaveStock = async () => {
    if (currentStock === listing.stock_qty) return
    setSavingStock(true)
    const { error } = await supabase
      .from('listings')
      .update({ stock_qty: currentStock })
      .eq('id', listing.id)
    setSavingStock(false)
    if (error) Alert.alert('Error', 'Could not update stock.')
    else invalidate()
  }

  const handleToggleStatus = async () => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active'
    setTogglingStatus(true)
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', listing.id)
    setTogglingStatus(false)
    if (error) Alert.alert('Error', 'Could not update listing status.')
    else invalidate()
  }

  const handleRemove = async () => {
    // Check for active orders on this listing before deleting
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listing.id)
      .in('status', ['pending_payment', 'pending', 'received', 'preparing'])

    const hasActiveOrders = (count ?? 0) > 0

    Alert.alert(
      'Remove listing',
      hasActiveOrders
        ? `This listing has ${count} active order${count !== 1 ? 's' : ''}. Removing it will not cancel those orders. Continue?`
        : 'This will permanently delete the listing. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true)
            const { error } = await supabase
              .from('listings')
              .delete()
              .eq('id', listing.id)
            setRemoving(false)
            if (error) {
              Alert.alert('Error', 'Could not remove listing.')
            } else {
              queryClient.invalidateQueries({ queryKey: ['seller-listings'] })
              queryClient.invalidateQueries({ queryKey: ['listings'] })
              router.replace('/(app)/sell')
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Image gallery */}
      <View style={styles.gallery}>
        <ScrollView
          ref={galleryRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onGalleryScroll}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <View key={i} style={styles.gallerySlide}>
              <Image
                source={uri ? { uri } : require('@/assets/listing-placeholder.png')}
                style={styles.galleryImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>

        {images.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>{activeImage + 1} / {images.length}</Text>
          </View>
        )}

        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner for paused listings */}
        {listing.status === 'paused' && (
          <View style={styles.pausedBanner}>
            <Text style={styles.pausedBannerText}>
              This listing is paused — not visible to buyers
            </Text>
          </View>
        )}

        {/* Price + title */}
        <View style={styles.titleSection}>
          <Text style={styles.price}>K {Number(listing.price_zmw).toLocaleString()}</Text>
          <Text style={styles.title}>{listing.title}</Text>
        </View>

        {/* Badges */}
        <View style={styles.badges}>
          {listing.category && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{listing.category.name}</Text>
            </View>
          )}
          <View style={[styles.badge, !inStock && styles.badgeOutOfStock]}>
            <Text style={[styles.badgeText, !inStock && styles.badgeTextOutOfStock]}>
              {inStock
                ? listing.stock_qty === 1 ? '1 available' : `${listing.stock_qty} in stock`
                : 'Out of stock'}
            </Text>
          </View>
        </View>

        {/* Description */}
        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Seller card — only for buyers */}
        {!isOwnListing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Seller</Text>
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>{sellerName[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{sellerName}</Text>
                {listing.seller?.location ? (
                  <Text style={styles.sellerLocation}>{listing.seller.location}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* ── Seller management panel ── */}
        {isOwnListing && (
          <View style={styles.managePanel}>
            <Text style={styles.managePanelTitle}>Manage listing</Text>

            {/* Stock control */}
            <View style={styles.manageRow}>
              <View style={styles.manageRowLeft}>
                <Text style={styles.manageRowLabel}>Stock</Text>
                <Text style={styles.manageRowSub}>
                  {currentStock === 0 ? 'Out of stock' : `${currentStock} available`}
                </Text>
              </View>
              <View style={styles.stockControls}>
                <TouchableOpacity
                  style={[styles.stockBtn, currentStock === 0 && styles.stockBtnDisabled]}
                  onPress={() => setStockQty(Math.max(0, currentStock - 1))}
                  disabled={currentStock === 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stockBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stockQty}>{currentStock}</Text>
                <TouchableOpacity
                  style={styles.stockBtn}
                  onPress={() => setStockQty(currentStock + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stockBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save stock — only show when changed */}
            {currentStock !== listing.stock_qty && (
              <TouchableOpacity
                style={[styles.saveStockBtn, savingStock && styles.saveStockBtnLoading]}
                onPress={handleSaveStock}
                disabled={savingStock}
                activeOpacity={0.85}
              >
                {savingStock
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.saveStockBtnText}>Save stock ({currentStock})</Text>
                }
              </TouchableOpacity>
            )}

            <View style={styles.manageDivider} />

            {/* Status toggle */}
            <TouchableOpacity
              style={styles.manageActionRow}
              onPress={handleToggleStatus}
              disabled={togglingStatus}
              activeOpacity={0.75}
            >
              <View>
                <Text style={styles.manageActionLabel}>
                  {listing.status === 'active' ? 'Pause listing' : 'Reactivate listing'}
                </Text>
                <Text style={styles.manageActionSub}>
                  {listing.status === 'active'
                    ? 'Hides from browse — buyers cannot find it'
                    : 'Makes listing visible to buyers again'}
                </Text>
              </View>
              {togglingStatus
                ? <ActivityIndicator color={Colors.textSecondary} size="small" />
                : <Feather name="chevron-right" size={18} color={Colors.gray400} />
              }
            </TouchableOpacity>

            <View style={styles.manageDivider} />

            {/* Edit */}
            <TouchableOpacity
              style={styles.manageActionRow}
              onPress={() => router.push(`/(app)/listing/edit/${listing.id}`)}
              activeOpacity={0.75}
            >
              <View>
                <Text style={styles.manageActionLabel}>Edit listing</Text>
                <Text style={styles.manageActionSub}>Change photos, title, price, description</Text>
              </View>
              <Text style={styles.manageActionChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.manageDivider} />

            {/* Remove */}
            <TouchableOpacity
              style={styles.manageActionRow}
              onPress={handleRemove}
              disabled={removing}
              activeOpacity={0.75}
            >
              <View>
                <Text style={[styles.manageActionLabel, styles.destructiveText]}>
                  Remove listing
                </Text>
                <Text style={styles.manageActionSub}>Permanently deletes this listing</Text>
              </View>
              {removing
                ? <ActivityIndicator color={Colors.error} size="small" />
                : <Text style={[styles.manageActionChevron, styles.destructiveText]}>›</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.postedDate}>Listed {formatRelativeDate(listing.created_at)}</Text>
      </ScrollView>

      {/* Fixed bottom bar — buyers only */}
      {!isOwnListing && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.buyBtn, !inStock && styles.buyBtnDisabled]}
            activeOpacity={0.85}
            disabled={!inStock}
            onPress={() => router.push(`/(app)/order/new?listingId=${listing.id}`)}
          >
            <View style={styles.buyBtnInner}>
              <View>
                <Text style={styles.buyBtnLabel}>{inStock ? 'Buy now' : 'Out of stock'}</Text>
                <Text style={styles.buyBtnPrice}>K {Number(listing.price_zmw).toLocaleString()}</Text>
              </View>
              {inStock && <Feather name="arrow-right" size={22} color={Colors.white} />}
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={Colors.black} size="large" />
    </View>
  )
}

function NotFoundScreen() {
  return (
    <View style={styles.centered}>
      <Text style={styles.notFoundText}>Listing not found</Text>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.notFoundBack}>← Go back</Text>
      </TouchableOpacity>
    </View>
  )
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days < 7)   return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Gallery
  gallery: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, backgroundColor: Colors.gray100 },
  gallerySlide: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT },
  galleryImage: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  imageCounter: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  imageCounterText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.white },
  dots: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: Colors.white, width: 18, borderRadius: 3 },

  // Content
  content: { flex: 1, backgroundColor: Colors.white },
  contentInner: { padding: 24, gap: 24 },

  // Paused banner
  pausedBanner: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: -8,
  },
  pausedBannerText: { ...Type.bodyMd, color: Colors.warning, fontFamily: Fonts.medium },

  titleSection: { gap: 6 },
  price: { fontFamily: Fonts.bold, fontSize: 30, color: Colors.textPrimary, letterSpacing: -0.5 },
  title: { ...Type.h2, color: Colors.textPrimary },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.gray100, borderWidth: 1, borderColor: Colors.border,
  },
  badgeOutOfStock: { backgroundColor: Colors.errorLight, borderColor: Colors.error },
  badgeText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  badgeTextOutOfStock: { color: Colors.error },

  section: { gap: 10 },
  sectionLabel: { ...Type.labelSm, color: Colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8 },
  description: { ...Type.bodyLg, color: Colors.textPrimary, lineHeight: 26, fontFamily: Fonts.regular },

  sellerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sellerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center',
  },
  sellerAvatarText: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.white },
  sellerInfo: { flex: 1, gap: 3 },
  sellerName: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  sellerLocation: { ...Type.bodyMd, color: Colors.textSecondary },

  // Manage panel
  managePanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  managePanelTitle: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: Colors.gray50,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  manageRowLeft: { gap: 2 },
  manageRowLabel: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  manageRowSub: { ...Type.bodySm, color: Colors.textSecondary },
  stockControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stockBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  stockBtnDisabled: { opacity: 0.4 },
  stockBtnText: { fontSize: 18, color: Colors.textPrimary, lineHeight: 22, fontFamily: Fonts.medium },
  stockQty: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textPrimary, minWidth: 28, textAlign: 'center' },
  saveStockBtn: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.black,
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStockBtnLoading: { opacity: 0.6 },
  saveStockBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.white },
  manageDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  manageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  manageActionLabel: { ...Type.bodyLg, color: Colors.textPrimary, fontFamily: Fonts.regular },
  manageActionSub: { ...Type.bodySm, color: Colors.textSecondary, marginTop: 1 },
  manageActionChevron: { color: Colors.gray400 },
  destructiveText: { color: Colors.error },

  postedDate: { ...Type.caption, color: Colors.textDisabled, marginTop: -8 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 14,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  buyBtn: { backgroundColor: Colors.black, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 },
  buyBtnDisabled: { backgroundColor: Colors.gray300 },
  buyBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buyBtnLabel: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 1 },
  buyBtnPrice: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.white, letterSpacing: -0.3 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.white },
  notFoundText: { ...Type.h3, color: Colors.textPrimary },
  notFoundBack: { ...Type.bodyMd, color: Colors.textSecondary, fontFamily: Fonts.medium },
})
