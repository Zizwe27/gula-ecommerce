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
import { useBuyerOrders, useSellerOrders, OrderWithRelations, OrderStatus } from '@/hooks/useOrders'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  pending:         'Pending',
  received:        'Received',
  preparing:       'Preparing',
  delivered:       'Delivered',
  completed:       'Completed',
  cancelled:       'Cancelled',
}

const STATUS_COLOR: Record<OrderStatus, { bg: string; text: string }> = {
  pending_payment: { bg: Colors.warningLight, text: Colors.warning },
  pending:         { bg: Colors.warningLight, text: Colors.warning },
  received:        { bg: Colors.gray100,      text: Colors.textSecondary },
  preparing:       { bg: Colors.gray100,      text: Colors.textSecondary },
  delivered:       { bg: Colors.successLight, text: Colors.success },
  completed:       { bg: Colors.successLight, text: Colors.success },
  cancelled:       { bg: Colors.errorLight,   text: Colors.error },
}

export default function OrdersScreen() {
  const { profile, sellerMode } = useAuthStore()
  const insets = useSafeAreaInsets()
  const isApprovedSeller = profile?.seller_status === 'approved'
  const isFulfillmentView = isApprovedSeller && sellerMode

  const buyerQuery  = useBuyerOrders(!isFulfillmentView ? profile?.id : undefined)
  const sellerQuery = useSellerOrders(isFulfillmentView  ? profile?.id : undefined)

  const { data: orders, isLoading, refetch, isRefetching } = isFulfillmentView ? sellerQuery : buyerQuery

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.heading}>
            {isFulfillmentView ? 'Fulfilment' : 'Purchases'}
          </Text>
          {isFulfillmentView && (
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>Seller</Text>
            </View>
          )}
        </View>
        <NotificationBell />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              isFulfillmentView={isFulfillmentView}
              onPress={() => router.push(`/(app)/order/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={44} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>
                {isFulfillmentView ? 'No orders yet' : 'No purchases yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {isFulfillmentView
                  ? 'Orders from buyers will appear here.'
                  : 'Browse listings and place your first order.'}
              </Text>
              {!isFulfillmentView && (
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => router.push('/(app)')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.browseBtnText}>Browse listings</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

function OrderRow({
  order,
  isFulfillmentView,
  onPress,
}: {
  order: OrderWithRelations
  isFulfillmentView: boolean
  onPress: () => void
}) {
  const thumb = order.listing_image
  const statusStyle = STATUS_COLOR[order.status] ?? STATUS_COLOR.pending
  const counterparty = isFulfillmentView
    ? order.buyer?.display_name
    : (order.seller?.shop_name ?? order.seller?.display_name)
  const showChat = order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled'

  return (
    <View>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
        <Image
          source={thumb ? { uri: thumb } : require('@/assets/listing-placeholder.png')}
          style={styles.thumb}
          contentFit="cover"
        />

        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{order.listing_title}</Text>
          <Text style={styles.rowMeta}>{counterparty}</Text>
          <Text style={styles.rowDate}>{formatDate(order.created_at)}</Text>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.rowPrice}>K {Number(order.total_zmw).toLocaleString()}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {STATUS_LABEL[order.status]}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {showChat && (
        <TouchableOpacity
          style={styles.chatRow}
          onPress={() => router.push(`/(app)/chat/${order.id}`)}
          activeOpacity={0.75}
        >
          <Text style={styles.chatRowText}>
            Chat with {isFulfillmentView ? 'buyer' : 'seller'} →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZM', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heading: {
    ...Type.h2,
    color: Colors.textPrimary,
  },
  modePill: {
    backgroundColor: Colors.black,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  modePillText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  rowMeta: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  rowDate: {
    ...Type.caption,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowPrice: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
  },
  chatRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingTop: 0,
    paddingBottom: 12,
  },
  chatRowText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyTitle: {
    ...Type.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  browseBtn: {
    marginTop: 8,
    backgroundColor: Colors.black,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.white,
  },
})
