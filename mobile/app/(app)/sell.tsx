import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useAuthStore } from '@/stores/auth'
import { useSellerListings } from '@/hooks/useSellerListings'
import { ListingWithRelations } from '@/hooks/useListings'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function SellScreen() {
  const { profile } = useAuthStore()
  const status = profile?.seller_status ?? null

  if (status === 'approved') return <SellerHome shopName={profile?.shop_name} sellerId={profile?.id} />
  if (status === 'pending')  return <ApplicationPending />
  if (status === 'rejected') return <ApplicationRejected reason={profile?.shop_name ?? null} />
  return <ApplySplash />
}

// ─── Never applied ────────────────────────────────────────────

function ApplySplash() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.splashContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.splashBadge}>
        <Text style={styles.splashBadgeText}>Become a seller</Text>
      </View>

      <Text style={styles.splashTitle}>Sell to buyers{'\n'}across Zambia</Text>
      <Text style={styles.splashSubtitle}>
        Join a growing community of sellers. Your payments are protected and your buyers are real.
      </Text>

      <View style={styles.perks}>
        {[
          { icon: 'tag', title: 'Free to list', body: 'No listing fees. Pay only when you sell.' },
          { icon: 'shield', title: 'Payments protected', body: 'Escrow holds funds until buyers confirm.' },
          { icon: 'smartphone', title: 'Built for Zambia', body: 'MTN and Airtel Money payouts directly to you.' },
        ].map((perk) => (
          <View key={perk.title} style={styles.perk}>
            <Feather name={perk.icon as any} size={16} color={Colors.black} style={styles.perkIcon} />
            <View style={styles.perkText}>
              <Text style={styles.perkTitle}>{perk.title}</Text>
              <Text style={styles.perkBody}>{perk.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(app)/seller-apply')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Apply to sell</Text>
      </TouchableOpacity>

      <Text style={styles.splashDisclaimer}>
        Applications are reviewed within 1–2 business days.
      </Text>
    </ScrollView>
  )
}

// ─── Pending ──────────────────────────────────────────────────

function ApplicationPending() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.stateContent}>
        <View style={[styles.stateIcon, { backgroundColor: Colors.warningLight }]}>
          <Feather name="clock" size={28} color={Colors.warning} />
        </View>
        <Text style={styles.stateTitle}>Application{'\n'}under review</Text>
        <Text style={styles.stateBody}>
          We're reviewing your application. This usually takes 1–2 business days.
          We'll notify you via SMS once a decision is made.
        </Text>
        <View style={styles.pendingNote}>
          <Text style={styles.pendingNoteText}>
            While you wait, you can still browse and buy on gula.
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Rejected ─────────────────────────────────────────────────

function ApplicationRejected({ reason }: { reason: string | null }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.stateContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={[styles.stateIcon, { backgroundColor: Colors.errorLight }]}>
        <Feather name="x-circle" size={28} color={Colors.error} />
      </View>
      <Text style={styles.stateTitle}>Application{'\n'}not approved</Text>
      <Text style={styles.stateBody}>
        Unfortunately your seller application was not approved at this time.
      </Text>

      {reason ? (
        <View style={styles.rejectionCard}>
          <Text style={styles.rejectionLabel}>Reason</Text>
          <Text style={styles.rejectionReason}>{reason}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(app)/seller-apply')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Apply again</Text>
      </TouchableOpacity>

      <Text style={styles.splashDisclaimer}>
        Address the reason above in your new application.
      </Text>
    </ScrollView>
  )
}

// ─── Approved seller home ─────────────────────────────────────

function SellerHome({ shopName, sellerId }: { shopName?: string | null; sellerId?: string }) {
  const insets = useSafeAreaInsets()
  const { data: listings, isLoading, refetch, isRefetching } = useSellerListings(sellerId)

  const activeCount = listings?.filter(l => l.status === 'active').length ?? 0
  const soldCount = listings?.filter(l => l.status === 'sold').length ?? 0

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.sellerFixedTop}>
        <View style={styles.sellerHeader}>
          <View>
            <Text style={styles.sellerGreeting}>Your shop</Text>
            <Text style={styles.shopName}>{shopName ?? 'My Shop'}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.85}
          onPress={() => router.push('/(app)/listing/new')}
        >
          <Text style={styles.createButtonText}>+ New listing</Text>
        </TouchableOpacity>

        <View style={styles.sellerStats}>
          {[
            { label: 'Active listings', value: String(activeCount) },
            { label: 'Sold', value: String(soldCount) },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.sellerListLoading}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : (
        <FlatList
          style={styles.sellerListScroll}
          data={listings ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.sellerListContent,
            (listings?.length ?? 0) === 0 && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={styles.sellerRowSep} />}
          ListEmptyComponent={
            <View style={styles.emptyListings}>
              <Text style={styles.emptyText}>No listings yet.</Text>
              <Text style={styles.emptySubtext}>Create your first listing to start selling.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SellerListingRow
              listing={item}
              onPress={() => router.push(`/(app)/listing/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  )
}

function SellerListingRow({
  listing,
  onPress,
}: {
  listing: ListingWithRelations
  onPress: () => void
}) {
  const thumb = listing.images?.[0]
  const inStock = listing.stock_qty > 0

  return (
    <TouchableOpacity style={styles.listingRow} onPress={onPress} activeOpacity={0.75}>
      <Image
        source={thumb ? { uri: thumb } : require('@/assets/listing-placeholder.png')}
        style={styles.listingThumb}
        contentFit="cover"
      />
      <View style={styles.listingRowInfo}>
        <Text style={styles.listingRowTitle} numberOfLines={2}>{listing.title}</Text>
        <Text style={styles.listingRowPrice}>K {Number(listing.price_zmw).toLocaleString()}</Text>
        <View style={[styles.listingRowBadge, !inStock && styles.listingRowBadgeSold]}>
          <Text style={[styles.listingRowBadgeText, !inStock && styles.listingRowBadgeTextSold]}>
            {listing.status === 'sold' ? 'Sold' : inStock ? `${listing.stock_qty} in stock` : 'Out of stock'}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.gray400} />
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Splash
  splashContent: {
    padding: 28,
    paddingTop: 64,
    gap: 20,
  },
  splashBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.black,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  splashBadgeText: {
    ...Type.labelSm,
    color: Colors.white,
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  splashTitle: {
    ...Type.displayMd,
    color: Colors.textPrimary,
  },
  splashSubtitle: {
    ...Type.bodyLg,
    color: Colors.textSecondary,
    lineHeight: 26,
  },
  perks: {
    gap: 16,
    paddingVertical: 8,
  },
  perk: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  perkIcon: {
    marginTop: 3,
  },
  perkText: {
    flex: 1,
    gap: 2,
  },
  perkTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  perkBody: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  button: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  splashDisclaimer: {
    ...Type.caption,
    color: Colors.textDisabled,
    textAlign: 'center',
  },

  // Pending / Rejected shared
  stateContent: {
    flex: 1,
    padding: 28,
    paddingTop: 80,
    alignItems: 'center',
    gap: 16,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: {
    ...Type.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateBody: {
    ...Type.bodyLg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  pendingNote: {
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  pendingNoteText: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  rejectionCard: {
    width: '100%',
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  rejectionLabel: {
    ...Type.labelSm,
    color: Colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rejectionReason: {
    ...Type.bodyMd,
    color: Colors.error,
  },

  // Seller home
  sellerContent: {
    padding: 24,
    paddingTop: 64,
    gap: 20,
  },
  sellerFixedTop: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sellerListScroll: {
    flex: 1,
  },
  sellerListContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  sellerListLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerRowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  sellerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sellerGreeting: {
    ...Type.labelMd,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  shopName: {
    ...Type.h2,
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    backgroundColor: Colors.black,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verifiedText: {
    ...Type.labelSm,
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  createButton: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  sellerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statValue: {
    ...Type.h2,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Type.bodySm,
    color: Colors.textSecondary,
  },
  emptyListings: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    marginTop: 8,
  },
  emptyText: {
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  emptySubtext: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listingsList: {
    gap: 1,
    backgroundColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.white,
  },
  listingThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
  },
  listingRowInfo: {
    flex: 1,
    gap: 4,
  },
  listingRowTitle: {
    ...Type.labelMd,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  listingRowPrice: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  listingRowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray100,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  listingRowBadgeSold: {
    backgroundColor: Colors.errorLight,
  },
  listingRowBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  listingRowBadgeTextSold: {
    color: Colors.error,
  },
})
