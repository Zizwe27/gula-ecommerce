import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAdminApplication, useReviewApplication } from '@/hooks/useAdminApplications'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function AdminApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { data: app, isLoading } = useAdminApplication(id)
  const { mutate: review, isPending: reviewing } = useReviewApplication()

  const [shopName, setShopName] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.black} size="large" /></View>
  }

  if (!app) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Application not found</Text>
      </View>
    )
  }

  const sendPushNotification = async (
    recipientId: string,
    title: string,
    body: string,
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.functions.invoke('push-notification', {
        body: { recipientId, title, body },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
    } catch {
      // Non-critical — don't block the approval flow
    }
  }

  const handleApprove = () => {
    const name = shopName.trim() || app.seller_name
    Alert.alert(
      'Approve application',
      `Approve "${name}" as a seller on gula.?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            review(
              {
                applicationId: app.id,
                userId: app.user_id,
                action: 'approve',
                shopName: name,
              },
              {
                onSuccess: async () => {
                  await sendPushNotification(
                    app.user_id,
                    'Application approved 🎉',
                    `Welcome to gula.! Your shop "${name}" is now live.`,
                  )
                  router.back()
                },
                onError: (err: any) => {
                  Alert.alert('Error', err.message ?? 'Could not approve application.')
                },
              },
            )
          },
        },
      ],
    )
  }

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Reason required', 'Please provide a reason for rejection.')
      return
    }
    Alert.alert(
      'Reject application',
      'This will notify the applicant. They can apply again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            review(
              {
                applicationId: app.id,
                userId: app.user_id,
                action: 'reject',
                rejectionReason: rejectionReason.trim(),
              },
              {
                onSuccess: async () => {
                  await sendPushNotification(
                    app.user_id,
                    'Application update',
                    'Your seller application was not approved. Open gula. to see details.',
                  )
                  router.back()
                },
                onError: (err: any) => {
                  Alert.alert('Error', err.message ?? 'Could not reject application.')
                },
              },
            )
          },
        },
      ],
    )
  }

  const idTypeLabel: Record<string, string> = {
    nrc: 'NRC',
    passport: 'Passport',
    driver_license: "Driver's licence",
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review application</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Applicant */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Applicant</Text>
          <Text style={styles.cardValue}>{app.profile?.display_name}</Text>
          <Text style={styles.cardSub}>{app.profile?.phone}</Text>
        </View>

        {/* Proposed shop */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Proposed shop name</Text>
          <Text style={styles.cardValue}>{app.seller_name}</Text>
        </View>

        {/* What they sell */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>What they plan to sell</Text>
          <Text style={styles.cardValueBody}>{app.description}</Text>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Location</Text>
          <Text style={styles.cardValue}>{app.location}</Text>
        </View>

        {/* Identity */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ID document</Text>
          <Text style={styles.cardValue}>{idTypeLabel[app.id_type] ?? app.id_type}</Text>
          <Text style={styles.cardSub}>{app.id_number}</Text>
        </View>

        {/* Mobile money */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Mobile money</Text>
          <Text style={styles.cardValue}>
            {app.mobile_money_provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
          </Text>
          <Text style={styles.cardSub}>{app.mobile_money_number}</Text>
        </View>

        {/* Applied */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Applied</Text>
          <Text style={styles.cardValue}>
            {new Date(app.created_at).toLocaleDateString('en-ZM', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
        </View>

        {app.status !== 'pending' && (
          <View style={[styles.card, { borderColor: app.status === 'approved' ? Colors.success : Colors.error }]}>
            <Text style={{ ...Type.labelSm, color: app.status === 'approved' ? Colors.success : Colors.error, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {app.status === 'approved' ? 'Approved' : 'Rejected'}
            </Text>
            {app.rejection_reason ? (
              <Text style={styles.cardValueBody}>{app.rejection_reason}</Text>
            ) : null}
          </View>
        )}

        {/* Actions — only for pending */}
        {app.status === 'pending' && (
          <>
            {/* Optional: override shop name */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Shop name to approve with</Text>
              <TextInput
                style={styles.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder={app.seller_name}
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="words"
              />
              <Text style={styles.fieldHint}>Leave blank to use their proposed name.</Text>
            </View>

            <TouchableOpacity
              style={[styles.approveBtn, reviewing && styles.btnDisabled]}
              onPress={handleApprove}
              disabled={reviewing}
              activeOpacity={0.85}
            >
              {reviewing && !showRejectForm
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.approveBtnText}>Approve application</Text>
              }
            </TouchableOpacity>

            {/* Reject section */}
            {!showRejectForm ? (
              <TouchableOpacity
                style={styles.rejectToggle}
                onPress={() => setShowRejectForm(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectToggleText}>Reject application</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.rejectForm}>
                <Text style={styles.fieldLabel}>Reason for rejection</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Explain why the application is not approved…"
                  placeholderTextColor={Colors.textDisabled}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.rejectActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowRejectForm(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, reviewing && styles.btnDisabled]}
                    onPress={handleReject}
                    disabled={reviewing}
                    activeOpacity={0.85}
                  >
                    {reviewing
                      ? <ActivityIndicator color={Colors.white} size="small" />
                      : <Text style={styles.rejectBtnText}>Confirm rejection</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { ...Type.h3, color: Colors.textDisabled },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.h3, color: Colors.textPrimary },
  content: { padding: 20, gap: 12 },
  card: {
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, gap: 3,
  },
  cardLabel: {
    ...Type.labelSm, color: Colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  cardValue: { ...Type.labelLg, color: Colors.textPrimary, fontFamily: Fonts.medium },
  cardSub: { ...Type.bodyMd, color: Colors.textSecondary },
  cardValueBody: { ...Type.bodyMd, color: Colors.textPrimary, lineHeight: 22 },
  section: { gap: 6 },
  fieldLabel: {
    ...Type.labelSm, color: Colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  input: {
    height: 52, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.textPrimary,
  },
  inputMultiline: {
    height: 88, paddingTop: 12, paddingBottom: 12,
  },
  fieldHint: { ...Type.caption, color: Colors.textDisabled },
  approveBtn: {
    backgroundColor: Colors.success, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  approveBtnText: { ...Type.labelLg, color: Colors.white, fontFamily: Fonts.bold },
  btnDisabled: { opacity: 0.5 },
  rejectToggle: {
    alignItems: 'center', paddingVertical: 14,
  },
  rejectToggleText: {
    ...Type.bodyMd, color: Colors.error, textDecorationLine: 'underline',
  },
  rejectForm: { gap: 10 },
  rejectActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textSecondary },
  rejectBtn: {
    flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.white },
})
