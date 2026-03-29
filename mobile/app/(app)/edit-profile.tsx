import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function EditProfileScreen() {
  const { profile, setProfile } = useAuthStore()
  const insets = useSafeAreaInsets()
  const isApprovedSeller = profile?.seller_status === 'approved'

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [shopName, setShopName] = useState(profile?.shop_name ?? '')
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const avatarSource = newAvatarUri ?? profile?.avatar_url ?? null
  const initial = (displayName[0] ?? profile?.display_name?.[0] ?? '?').toUpperCase()

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to change your profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setNewAvatarUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter your display name.')
      return
    }
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null

      if (newAvatarUri) {
        const ext = newAvatarUri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${profile!.id}/avatar.${ext}`
        const response = await fetch(newAvatarUri)
        const blob = await response.blob()
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: `image/${ext}` })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = publicUrl
      }

      const updates: Record<string, string | null> = {
        display_name: displayName.trim(),
        location: location.trim() || null,
        avatar_url: avatarUrl,
      }
      if (isApprovedSeller) {
        updates.shop_name = shopName.trim() || null
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile!.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      router.back()
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarRow} onPress={pickAvatar} activeOpacity={0.8}>
          <View style={styles.avatarWrap}>
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Feather name="camera" size={13} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </TouchableOpacity>

        {/* Display name */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Phone — read only */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Phone</Text>
          <View style={styles.inputLocked}>
            <Text style={styles.inputLockedText}>{profile?.phone ?? '—'}</Text>
            <Feather name="lock" size={14} color={Colors.textDisabled} />
          </View>
          <Text style={styles.hint}>Phone number cannot be changed.</Text>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Lusaka, Kitwe"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Shop name — sellers only */}
        {isApprovedSeller && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Shop name</Text>
            <TextInput
              style={styles.input}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Your shop name"
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.hint}>Shown to buyers on your listings and orders.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.h3, color: Colors.textPrimary },
  saveBtn: {
    backgroundColor: Colors.black,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.gray300 },
  saveBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.white },

  content: { padding: 24, gap: 20 },

  avatarRow: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.gray100 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...Type.h1, color: Colors.white, fontFamily: Fonts.bold },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray700,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarHint: { ...Type.bodySm, color: Colors.textDisabled },

  section: { gap: 6 },
  fieldLabel: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputLocked: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.gray50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLockedText: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textDisabled },
  hint: { ...Type.caption, color: Colors.textDisabled, lineHeight: 16 },
})
