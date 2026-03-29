import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
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
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{profile?.display_name}</Text>
          <Text style={styles.phone}>{profile?.phone}</Text>
          {profile?.location ? (
            <Text style={styles.location}>{profile.location}</Text>
          ) : null}
        </View>
      </View>

      {/* Seller status badge */}
      {profile?.seller_status ? (
        <View style={[
          styles.statusBadge,
          { borderColor: sellerStatusColor[profile.seller_status] }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: sellerStatusColor[profile.seller_status] }
          ]} />
          <Text style={[
            styles.statusText,
            { color: sellerStatusColor[profile.seller_status] }
          ]}>
            {sellerStatusLabel[profile.seller_status]}
          </Text>
        </View>
      ) : null}

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
