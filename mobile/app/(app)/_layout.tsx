import { Tabs, Redirect } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/auth'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationPermissionSheet } from '@/components/ui/NotificationPermissionSheet'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/typography'

type FeatherName = React.ComponentProps<typeof Feather>['name']

function TabIcon({
  label,
  icon,
  focused,
  badge,
}: {
  label: string
  icon: FeatherName
  focused: boolean
  badge?: number
}) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Feather name={icon} size={21} color={focused ? Colors.black : Colors.gray400} />
        {badge != null && badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

export default function AppLayout() {
  const { session, profile, sellerMode, notificationSeenAt } = useAuthStore()
  const { data: notifData } = useNotifications(profile?.id, notificationSeenAt)
  const unreadMessages = notifData?.unreadMessageCount ?? 0

  if (!session) return <Redirect href="/(auth)/login" />

  const isApprovedSeller = profile?.seller_status === 'approved'
  const showSellTab = isApprovedSeller && sellerMode

  return (
    <>
    <NotificationPermissionSheet />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Browse" icon="grid" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          href: showSellTab ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Shop" icon="shopping-bag" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label={sellerMode && isApprovedSeller ? 'Sales' : 'Orders'}
              icon="package"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Messages"
              icon="mail"
              focused={focused}
              badge={unreadMessages}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Profile" icon="user" focused={focused} />
          ),
        }}
      />

      {/* Hide non-tab routes from tab bar */}
      <Tabs.Screen name="seller-apply" options={{ href: null }} />
      <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      <Tabs.Screen name="listing/new" options={{ href: null }} />
      <Tabs.Screen name="order/new" options={{ href: null }} />
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      <Tabs.Screen name="listing/edit/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[orderId]" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
    </>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 8,
    color: Colors.white,
    lineHeight: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.gray400,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelFocused: {
    color: Colors.black,
  },
})
