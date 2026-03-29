import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

// expo-notifications remote push support was removed from Expo Go in SDK 53.
// Dynamic require lets the app load normally in Expo Go without crashing.
let Notifications: typeof import('expo-notifications') | null = null
try {
  Notifications = require('expo-notifications')
} catch {
  // Expo Go — push notifications not supported, sheet will never show
}

// Module-level flag — once dismissed or handled, don't show again this session
let promptShownThisSession = false

export function NotificationPermissionSheet() {
  const { session } = useAuthStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!Notifications || !session?.user || promptShownThisSession || Platform.OS === 'web') return

    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === 'undetermined') {
        setVisible(true)
        promptShownThisSession = true
      }
    })
  }, [session?.user?.id])

  const dismiss = () => setVisible(false)

  const handleAllow = async () => {
    dismiss()
    if (!Notifications || !session?.user?.id) return
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return
    try {
      const { data: tokenData } = await Notifications.getExpoPushTokenAsync()
      if (!tokenData) return
      await supabase
        .from('profiles')
        .update({ push_token: tokenData })
        .eq('id', session.user.id)
    } catch {
      // Simulator or missing credentials — silently ignore
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <Feather name="bell" size={32} color={Colors.black} />
          </View>

          <Text style={styles.title}>Stay in the loop</Text>
          <Text style={styles.body}>
            Get notified when your order is confirmed, prepared, or delivered — and when you have new messages from a buyer or seller.
          </Text>

          <View style={styles.perks}>
            {[
              { icon: 'package', text: 'Order status updates' },
              { icon: 'mail', text: 'New chat messages' },
              { icon: 'check-circle', text: 'Delivery confirmations' },
            ].map((item) => (
              <View key={item.text} style={styles.perk}>
                <Feather name={item.icon as any} size={16} color={Colors.textSecondary} />
                <Text style={styles.perkText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.allowBtn} onPress={handleAllow} activeOpacity={0.85}>
            <Text style={styles.allowBtnText}>Allow notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={dismiss} activeOpacity={0.7}>
            <Text style={styles.skipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    marginBottom: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  perks: {
    width: '100%',
    gap: 10,
    paddingVertical: 4,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perkText: {
    ...Type.bodyMd,
    color: Colors.textPrimary,
  },
  allowBtn: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  allowBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.white,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    ...Type.bodyMd,
    color: Colors.textDisabled,
  },
})
