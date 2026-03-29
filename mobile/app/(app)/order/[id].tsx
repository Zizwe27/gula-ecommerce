import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useAdvanceOrderStatus, OrderStatus } from '@/hooks/useOrders'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

// Steps shown in the checklist — we omit pending_payment from the visual list
// and treat it as implicit (the order exists = payment was attempted)
const STEPS: { key: OrderStatus; sellerLabel: string; buyerLabel: string }[] = [
  { key: 'pending',   sellerLabel: 'Order received',     buyerLabel: 'Order placed' },
  { key: 'received',  sellerLabel: 'Confirmed receipt',  buyerLabel: 'Seller confirmed' },
  { key: 'preparing', sellerLabel: 'Preparing order',    buyerLabel: 'Being prepared' },
  { key: 'delivered', sellerLabel: 'Marked as delivered',buyerLabel: 'Out for delivery' },
  { key: 'completed', sellerLabel: 'Buyer confirmed',    buyerLabel: 'Confirmed received' },
]

// What each party can do to advance the order
const SELLER_ACTIONS: Partial<Record<OrderStatus, { prompt: string; next: OrderStatus }>> = {
  pending_payment: { prompt: 'Confirm payment was received from buyer?', next: 'pending' },
  pending:         { prompt: 'Confirm you have received this order?',    next: 'received' },
  received:        { prompt: 'Mark this order as being prepared?',       next: 'preparing' },
  preparing:       { prompt: 'Mark as delivered to the buyer?',          next: 'delivered' },
}

const BUYER_ACTIONS: Partial<Record<OrderStatus, { prompt: string; next: OrderStatus }>> = {
  delivered: { prompt: 'Confirm you received your order? This releases payment to the seller.', next: 'completed' },
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { profile } = useAuthStore()
  const { mutate: advanceStatus, isPending: advancing } = useAdvanceOrderStatus()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          listing:listings(id, title, images, price_zmw),
          seller:profiles!orders_seller_id_fkey(id, display_name, shop_name, phone),
          buyer:profiles!orders_buyer_id_fkey(id, display_name, phone)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.black} size="large" /></View>
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isSeller = profile?.id === order.seller_id
  const isBuyer  = profile?.id === order.buyer_id

  const sellerAction = SELLER_ACTIONS[order.status as OrderStatus]
  const buyerAction  = BUYER_ACTIONS[order.status as OrderStatus]
  const myAction = isSeller ? sellerAction : isBuyer ? buyerAction : undefined

  // Find which STEPS index is "done" — map order status to STEPS
  const currentStepKey: OrderStatus = order.status === 'pending_payment' ? 'pending' : order.status as OrderStatus
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStepKey)
  // completed = all done, so treat it as past the last step
  const doneUpTo = order.status === 'completed' ? STEPS.length : currentStepIndex

  const handleAdvance = (action: { prompt: string; next: OrderStatus }) => {
    Alert.alert(
      'Confirm',
      action.prompt,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () =>
            advanceStatus({
              orderId: order.id,
              status: action.next,
              buyerId: order.buyer_id,
              sellerId: order.seller_id,
            }),
        },
      ]
    )
  }

  const isComplete = order.status === 'completed' || order.status === 'cancelled'
  const showChat = !isComplete && (isBuyer || isSeller)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Item + status */}
        <View style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>{order.listing_title}</Text>
            <Text style={styles.itemPrice}>K {Number(order.total_zmw).toLocaleString()}</Text>
          </View>
          <StatusBadge status={order.status as OrderStatus} />
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistHeading}>Progress</Text>

          {/* pending_payment step shown separately when still at that stage */}
          {order.status === 'pending_payment' && (
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, styles.stepIconPending]}>
                <Feather name="clock" size={14} color={Colors.warning} />
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepLabel, styles.stepLabelPending]}>Awaiting payment confirmation</Text>
                {isSeller && (
                  <Text style={styles.stepHint}>Tap "Confirm payment" below once you receive it.</Text>
                )}
              </View>
            </View>
          )}

          {STEPS.map((step, i) => {
            const done      = i < doneUpTo
            const active    = i === doneUpTo && order.status !== 'completed'
            const isMyStep  = active && myAction?.next === step.key
            const label     = isSeller ? step.sellerLabel : step.buyerLabel

            return (
              <TouchableOpacity
                key={step.key}
                style={[styles.stepRow, isMyStep && styles.stepRowActionable]}
                onPress={isMyStep ? () => handleAdvance(myAction!) : undefined}
                activeOpacity={isMyStep ? 0.7 : 1}
                disabled={!isMyStep || advancing}
              >
                {/* Checkbox */}
                <View style={[
                  styles.stepIcon,
                  done      && styles.stepIconDone,
                  active    && !isMyStep && styles.stepIconActive,
                  isMyStep  && styles.stepIconActionable,
                  !done && !active && styles.stepIconFuture,
                ]}>
                  {done ? (
                    <Feather name="check" size={13} color={Colors.white} />
                  ) : isMyStep ? (
                    advancing
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Feather name="square" size={13} color={Colors.white} />
                  ) : (
                    <View style={styles.stepIconEmpty} />
                  )}
                </View>

                {/* Label */}
                <View style={styles.stepBody}>
                  <Text style={[
                    styles.stepLabel,
                    done     && styles.stepLabelDone,
                    active   && styles.stepLabelActive,
                    !done && !active && styles.stepLabelFuture,
                  ]}>
                    {label}
                  </Text>
                  {isMyStep && (
                    <Text style={styles.stepCta}>Tap to confirm</Text>
                  )}
                </View>

                {isMyStep && (
                  <Feather name="chevron-right" size={16} color={Colors.black} />
                )}
              </TouchableOpacity>
            )
          })}

          {/* Buyer action when seller hasn't advanced yet but status is pending_payment */}
          {isSeller && order.status === 'pending_payment' && (
            <TouchableOpacity
              style={[styles.stepRow, styles.stepRowActionable]}
              onPress={() => handleAdvance(SELLER_ACTIONS.pending_payment!)}
              activeOpacity={0.7}
              disabled={advancing}
            >
              <View style={styles.stepIcon}>
                {advancing
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Feather name="square" size={13} color={Colors.white} />
                }
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>Confirm payment received</Text>
                <Text style={styles.stepCta}>Tap to confirm</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.black} />
            </TouchableOpacity>
          )}
        </View>

        {/* Counterparty */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{isSeller ? 'Buyer' : 'Seller'}</Text>
          <Text style={styles.infoValue}>
            {isSeller
              ? order.buyer?.display_name
              : (order.seller?.shop_name ?? order.seller?.display_name)}
          </Text>
          <Text style={styles.infoSub}>
            {isSeller ? order.buyer?.phone : order.seller?.phone}
          </Text>
        </View>

        {/* Delivery address */}
        {order.delivery_address ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Delivery address</Text>
            <Text style={styles.infoValue}>{order.delivery_address}</Text>
          </View>
        ) : null}

        {/* Payment */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Payment</Text>
          <Text style={styles.infoValue}>
            {order.payment_provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
          </Text>
          {order.payment_reference ? (
            <Text style={styles.infoSub}>{order.payment_reference}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Chat button */}
      {showChat && (
        <TouchableOpacity
          style={[styles.chatBtn, { bottom: insets.bottom + 20 }]}
          onPress={() => router.push(`/(app)/chat/${order.id}`)}
          activeOpacity={0.85}
        >
          <Feather name="mail" size={16} color={Colors.textPrimary} />
          <Text style={styles.chatBtnText}>Chat with {isSeller ? 'buyer' : 'seller'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; bg: string; color: string }> = {
    pending_payment: { label: 'Awaiting payment', bg: Colors.warningLight, color: Colors.warning },
    pending:         { label: 'Pending',           bg: Colors.warningLight, color: Colors.warning },
    received:        { label: 'Received',          bg: Colors.gray100,     color: Colors.textSecondary },
    preparing:       { label: 'Preparing',         bg: Colors.gray100,     color: Colors.textSecondary },
    delivered:       { label: 'Delivered',         bg: Colors.successLight,color: Colors.success },
    completed:       { label: 'Completed',         bg: Colors.successLight,color: Colors.success },
    cancelled:       { label: 'Cancelled',         bg: Colors.errorLight,  color: Colors.error },
  }
  const s = map[status] ?? map.pending
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>{s.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.white },
  notFoundText: { ...Type.h3, color: Colors.textPrimary },
  backLink: { ...Type.bodyMd, color: Colors.textSecondary },

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

  content: { padding: 20, gap: 16 },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemInfo: { flex: 1, gap: 3 },
  itemTitle: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  itemPrice: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textPrimary },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { fontFamily: Fonts.medium, fontSize: 12 },

  // Checklist
  checklistCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  checklistHeading: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stepRowActionable: {
    backgroundColor: Colors.gray50,
  },
  stepIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: {
    backgroundColor: Colors.black,
  },
  stepIconActive: {
    backgroundColor: Colors.gray400,
  },
  stepIconActionable: {
    backgroundColor: Colors.black,
  },
  stepIconPending: {
    backgroundColor: Colors.warningLight,
  },
  stepIconFuture: {
    backgroundColor: Colors.gray100,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stepIconEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray300,
  },
  stepBody: { flex: 1, gap: 2 },
  stepLabel: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textDisabled },
  stepLabelDone: { color: Colors.textPrimary, fontFamily: Fonts.medium },
  stepLabelActive: { color: Colors.textPrimary, fontFamily: Fonts.medium },
  stepLabelFuture: { color: Colors.textDisabled },
  stepLabelPending: { color: Colors.warning, fontFamily: Fonts.medium },
  stepCta: { ...Type.caption, color: Colors.textSecondary },
  stepHint: { ...Type.caption, color: Colors.textDisabled },

  // Info cards
  infoCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 3,
  },
  infoLabel: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  infoSub: { ...Type.bodyMd, color: Colors.textSecondary },

  // Chat button
  chatBtn: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.black,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chatBtnText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textPrimary },
})
