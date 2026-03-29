import { Tabs, Redirect } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/auth'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/typography'

type FeatherName = React.ComponentProps<typeof Feather>['name']

function TabIcon({ label, icon, focused }: { label: string; icon: FeatherName; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Feather name={icon} size={22} color={focused ? Colors.black : Colors.gray400} />
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  )
}

export default function AppLayout() {
  const { session, profile, sellerMode } = useAuthStore()
  if (!session) return <Redirect href="/(auth)/login" />

  const isApprovedSeller = profile?.seller_status === 'approved'
  const showSellTab = isApprovedSeller && sellerMode

  return (
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
              label={sellerMode && isApprovedSeller ? 'Fulfil' : 'Purchases'}
              icon="package"
              focused={focused}
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
    </Tabs>
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
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.gray400,
    letterSpacing: 0.3,
  },
  tabLabelFocused: {
    color: Colors.black,
  },
})
