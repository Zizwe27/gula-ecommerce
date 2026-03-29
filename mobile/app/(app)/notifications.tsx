import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  SectionList,
} from 'react-native'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { useNotifications, NotificationThread, OrderNotification } from '@/hooks/useNotifications'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending:   'Order placed',
  received:  'Seller confirmed receipt',
  preparing: 'Order being prepared',
  delivered: 'Order delivered',
}

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending:   Colors.warning,
  received:  Colors.textSecondary,
  preparing: Colors.textSecondary,
  delivered: Colors.success,
}

export default function NotificationsScreen() {
  const { profile, notificationSeenAt, markNotificationsSeen } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { data, isLoading, refetch, isRefetching } = useNotifications(
    profile?.id,
    notificationSeenAt
  )

  // Mark all as seen when this screen opens
  useEffect(() => {
    markNotificationsSeen()
  }, [])

  const sections = []

  if (data?.threads?.length) {
    sections.push({
      title: 'Messages',
      data: data.threads,
      type: 'thread' as const,
    })
  }

  if (data?.orderUpdates?.length) {
    sections.push({
      title: 'Order activity',
      data: data.orderUpdates,
      type: 'order' as const,
    })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bell" size={44} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyBody}>
            Messages and order updates will appear here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            'conversationId' in item ? item.conversationId : item.orderId + index
          }
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.type === 'thread' ? (
              <ThreadRow
                item={item as NotificationThread}
                userId={profile?.id}
                seenAt={notificationSeenAt}
              />
            ) : (
              <OrderRow item={item as OrderNotification} />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  )
}

function ThreadRow({
  item,
  userId,
  seenAt,
}: {
  item: NotificationThread
  userId?: string
  seenAt: number
}) {
  const isUnread =
    item.lastSenderId !== userId &&
    new Date(item.lastMessageAt).getTime() > (seenAt > 0 ? seenAt : Date.now() - 48 * 3600 * 1000)

  const isMe = item.lastSenderId === userId

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/(app)/chat/${item.orderId}`)}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={[styles.avatar, isUnread && styles.avatarUnread]}>
        <Text style={styles.avatarText}>
          {item.otherPartyName[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, isUnread && styles.rowNameUnread]} numberOfLines={1}>
            {item.otherPartyName}
          </Text>
          <Text style={styles.rowTime}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.listingTitle ? `Re: ${item.listingTitle}` : ''}
        </Text>
        <Text
          style={[styles.rowPreview, isUnread && styles.rowPreviewUnread]}
          numberOfLines={1}
        >
          {isMe ? `You: ${item.lastMessage}` : item.lastMessage}
        </Text>
      </View>

      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  )
}

function OrderRow({ item }: { item: OrderNotification }) {
  const statusColor = ORDER_STATUS_COLOR[item.status] ?? Colors.textSecondary
  const statusLabel = ORDER_STATUS_LABEL[item.status] ?? item.status

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/(app)/order/${item.orderId}`)}
      activeOpacity={0.75}
    >
      <View style={styles.orderIconWrap}>
        <Feather name="box" size={20} color={Colors.textSecondary} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.listingTitle ?? 'Order update'}
          </Text>
          <Text style={styles.rowTime}>{formatTime(item.updatedAt)}</Text>
        </View>
        <Text style={[styles.orderStatus, { color: statusColor }]}>
          {item.isSeller ? 'Incoming order' : statusLabel}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  if (mins < 1)   return 'now'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7)   return `${days}d`
  return new Date(iso).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short' })
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  heading: { ...Type.h3, color: Colors.textPrimary },

  sectionTitle: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
    backgroundColor: Colors.white,
  },

  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.white,
  },

  // Thread avatar
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarUnread: { backgroundColor: Colors.black },
  avatarText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },

  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...Type.labelLg, color: Colors.textSecondary, fontFamily: Fonts.regular, flex: 1 },
  rowNameUnread: { color: Colors.textPrimary, fontFamily: Fonts.bold },
  rowTime: { ...Type.caption, color: Colors.textDisabled, marginLeft: 8 },
  rowSub: { ...Type.caption, color: Colors.textDisabled },
  rowPreview: { ...Type.bodyMd, color: Colors.textSecondary },
  rowPreviewUnread: { color: Colors.textPrimary, fontFamily: Fonts.medium },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.black,
    flexShrink: 0,
  },

  // Order row
  orderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  orderStatus: { ...Type.bodyMd, fontFamily: Fonts.medium },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    marginTop: -60,
  },
  emptyIcon: { marginBottom: 4 },
  emptyTitle: { ...Type.h3, color: Colors.textPrimary },
  emptyBody: { ...Type.bodyMd, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
