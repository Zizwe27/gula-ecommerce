import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { useNotifications, NotificationThread } from '@/hooks/useNotifications'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function MessagesScreen() {
  const { profile, notificationSeenAt, markNotificationsSeen } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { data, isLoading, refetch, isRefetching } = useNotifications(
    profile?.id,
    notificationSeenAt
  )

  // Mark messages as seen when this screen opens
  useEffect(() => {
    markNotificationsSeen()
  }, [])

  const threads = data?.threads ?? []

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <Text style={styles.heading}>Messages</Text>
        <NotificationBell />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="mail" size={44} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>
            When you place or receive an order, you can chat with the other party here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.conversationId}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ThreadRow
              item={item}
              userId={profile?.id}
              seenAt={notificationSeenAt}
            />
          )}
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
        {item.listingTitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>Re: {item.listingTitle}</Text>
        ) : null}
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
    paddingHorizontal: 20,
    paddingRight: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heading: { ...Type.h2, color: Colors.textPrimary },

  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.white,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarUnread: { backgroundColor: Colors.black },
  avatarText: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.white },

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

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    marginTop: -60,
  },
  emptyTitle: { ...Type.h3, color: Colors.textPrimary },
  emptyBody: { ...Type.bodyMd, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
