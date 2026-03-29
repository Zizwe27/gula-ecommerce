import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useAuthStore } from '@/stores/auth'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function ProfileScreen() {
  const { profile, sellerMode, setSellerMode, signOut } = useAuthStore()

  const isApprovedSeller = profile?.seller_status === 'approved'

  const sellerStatusLabel: Record<string, string> = {
    pending: 'Application under review',
    approved: 'Verified seller',
    rejected: 'Application not approved',
  }

  const sellerStatusColor: Record<string, string> = {
    pending: Colors.warning,
    approved: Colors.success,
    rejected: Colors.error,
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.headingRow}>
        <Text style={styles.heading}>Profile</Text>
        <NotificationBell />
      </View>

      {/* Mode switcher — only for approved sellers */}
      {isApprovedSeller && (
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeOption, !sellerMode && styles.modeOptionActive]}
            onPress={() => setSellerMode(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeOptionText, !sellerMode && styles.modeOptionTextActive]}>
              Buying
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeOption, sellerMode && styles.modeOptionActive]}
            onPress={() => setSellerMode(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeOptionText, sellerMode && styles.modeOptionTextActive]}>
              Selling
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode description */}
      {isApprovedSeller && (
        <Text style={styles.modeHint}>
          {sellerMode
            ? 'You are in seller mode. Manage your shop, listings, and incoming orders.'
            : 'You are in buyer mode. Browse listings and track your purchases.'}
        </Text>
      )}

      {/* Identity card */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(app)/edit-profile')}
        activeOpacity={0.85}
      >
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{profile?.display_name}</Text>
          <Text style={styles.phone}>{profile?.phone}</Text>
          {profile?.location ? (
            <Text style={styles.location}>{profile.location}</Text>
          ) : null}
        </View>
        <Feather name="edit-2" size={16} color={Colors.gray400} />
      </TouchableOpacity>

      {/* Seller status badge — approved sellers */}
      {profile?.seller_status === 'approved' && (
        <View style={[styles.statusBadge, { borderColor: Colors.success }]}>
          <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
          <Text style={[styles.statusText, { color: Colors.success }]}>Verified seller</Text>
        </View>
      )}

      {/* Seller CTA — not yet applied */}
      {!profile?.seller_status && (
        <TouchableOpacity
          style={styles.sellerCta}
          onPress={() => router.push('/(app)/seller-apply')}
          activeOpacity={0.85}
        >
          <View style={styles.sellerCtaLeft}>
            <Text style={styles.sellerCtaTitle}>Start selling on gula.</Text>
            <Text style={styles.sellerCtaBody}>List your products and reach buyers across Zambia.</Text>
          </View>
          <View style={styles.sellerCtaBtn}>
            <Text style={styles.sellerCtaBtnText}>Apply</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Seller CTA — pending */}
      {profile?.seller_status === 'pending' && (
        <View style={[styles.statusBadge, { borderColor: Colors.warning }]}>
          <Feather name="clock" size={14} color={Colors.warning} style={{ marginRight: 2 }} />
          <Text style={[styles.statusText, { color: Colors.warning }]}>Application under review</Text>
        </View>
      )}

      {/* Seller CTA — rejected, allow re-apply */}
      {profile?.seller_status === 'rejected' && (
        <TouchableOpacity
          style={[styles.sellerCta, styles.sellerCtaRejected]}
          onPress={() => router.push('/(app)/seller-apply')}
          activeOpacity={0.85}
        >
          <View style={styles.sellerCtaLeft}>
            <Text style={[styles.sellerCtaTitle, { color: Colors.error }]}>Application not approved</Text>
            <Text style={styles.sellerCtaBody}>You can submit a new application.</Text>
          </View>
          <View style={[styles.sellerCtaBtn, { backgroundColor: Colors.error }]}>
            <Text style={styles.sellerCtaBtnText}>Apply again</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/(app)/edit-profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.actionLabel}>Edit profile</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionLabel}>Help & support</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
        {profile?.is_admin && (
          <>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/(app)/admin')}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionLabel, styles.adminLabel]}>Seller applications</Text>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.signOut}
        onPress={async () => {
          await signOut()
          router.replace('/(auth)/login')
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 64,
    gap: 16,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heading: {
    ...Type.h2,
    color: Colors.textPrimary,
  },

  // Mode switcher
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionActive: {
    backgroundColor: Colors.black,
  },
  modeOptionText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modeOptionTextActive: {
    color: Colors.white,
  },
  modeHint: {
    ...Type.bodySm,
    color: Colors.textDisabled,
    lineHeight: 18,
    marginTop: -4,
  },

  // Identity card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...Type.h2,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Type.h3,
    color: Colors.textPrimary,
  },
  phone: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  location: {
    ...Type.bodySm,
    color: Colors.textDisabled,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: Colors.white,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Type.labelMd,
    fontFamily: Fonts.medium,
  },

  // Seller CTA card
  sellerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.black,
    borderRadius: 16,
    padding: 18,
  },
  sellerCtaRejected: {
    backgroundColor: Colors.errorLight,
  },
  sellerCtaLeft: {
    flex: 1,
    gap: 3,
  },
  sellerCtaTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.white,
  },
  sellerCtaBody: {
    ...Type.bodySm,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },
  sellerCtaBtn: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sellerCtaBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.black,
  },
  actions: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionLabel: {
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
  },
  actionChevron: {
    fontSize: 20,
    color: Colors.gray400,
    lineHeight: 24,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  adminLabel: {
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  signOut: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutText: {
    ...Type.labelLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
})
