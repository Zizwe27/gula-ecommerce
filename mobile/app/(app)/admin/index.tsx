import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { useAdminApplications, SellerApplication } from '@/hooks/useAdminApplications'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function AdminScreen() {
  const { profile } = useAuthStore()
  const insets = useSafeAreaInsets()

  if (!profile?.is_admin) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Feather name="lock" size={36} color={Colors.gray300} />
        <Text style={styles.noAccess}>Access restricted</Text>
      </View>
    )
  }

  return <AdminApplicationsList insets={insets} />
}

function AdminApplicationsList({ insets }: { insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets> }) {
  const { data: applications, isLoading, refetch, isRefetching } = useAdminApplications('pending')

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller applications</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : (
        <FlatList
          data={applications ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ApplicationRow
              application={item}
              onPress={() => router.push(`/(app)/admin/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={44} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyBody}>No pending seller applications.</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

function ApplicationRow({
  application,
  onPress,
}: {
  application: SellerApplication
  onPress: () => void
}) {
  const initial = application.profile?.display_name?.[0]?.toUpperCase() ?? '?'

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {application.profile?.avatar_url ? (
        <Image source={{ uri: application.profile.avatar_url }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{application.profile?.display_name}</Text>
        <Text style={styles.rowPhone}>{application.profile?.phone}</Text>
        <Text style={styles.rowShop}>"{application.seller_name}"</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowDate}>
          {new Date(application.created_at).toLocaleDateString('en-ZM', {
            day: 'numeric', month: 'short',
          })}
        </Text>
        <Feather name="chevron-right" size={18} color={Colors.gray400} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.h3, color: Colors.textPrimary },
  list: { paddingBottom: 40 },
  separator: { height: 1, backgroundColor: Colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.gray100 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { ...Type.h3, color: Colors.white, fontFamily: Fonts.bold },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  rowPhone: { ...Type.bodyMd, color: Colors.textSecondary },
  rowShop: { ...Type.bodySm, color: Colors.textDisabled, fontStyle: 'italic' },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowDate: { ...Type.caption, color: Colors.textDisabled },
  noAccess: { ...Type.h3, color: Colors.textDisabled, marginTop: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { ...Type.h3, color: Colors.textPrimary },
  emptyBody: { ...Type.bodyMd, color: Colors.textSecondary },
})
