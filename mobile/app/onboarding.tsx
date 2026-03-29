import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

const ZAMBIAN_CITIES = [
  'Lusaka', 'Kitwe', 'Ndola', 'Livingstone',
  'Chipata', 'Kabwe', 'Solwezi', 'Mansa', 'Kasama', 'Mongu',
]

export default function OnboardingScreen() {
  const { session, fetchProfile } = useAuthStore()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; location?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) e.name = 'Enter your full name'
    if (!location.trim()) e.location = 'Select or enter your city'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleContinue = async () => {
    if (!validate() || !session?.user) return
    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        location: location.trim(),
        onboarded: true,
      })
      .eq('id', session.user.id)

    if (error) { setLoading(false); return }

    await fetchProfile(session.user.id)
    setLoading(false)
    router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>gula</Text>
          <Text style={styles.title}>Let's set up{'\n'}your account</Text>
          <Text style={styles.subtitle}>This takes less than a minute.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="e.g. Mwila Banda"
              placeholderTextColor={Colors.textDisabled}
              value={name}
              onChangeText={(t) => { setErrors(e => ({ ...e, name: undefined })); setName(t) }}
              autoCapitalize="words"
              autoFocus
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Your city or town</Text>
            <TextInput
              style={[styles.input, errors.location ? styles.inputError : null]}
              placeholder="e.g. Lusaka"
              placeholderTextColor={Colors.textDisabled}
              value={location}
              onChangeText={(t) => { setErrors(e => ({ ...e, location: undefined })); setLocation(t) }}
              autoCapitalize="words"
            />
            {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}

            {/* City quick-select */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {ZAMBIAN_CITIES.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[styles.chip, location === city && styles.chipSelected]}
                  onPress={() => { setErrors(e => ({ ...e, location: undefined })); setLocation(city) }}
                >
                  <Text style={[styles.chipText, location === city && styles.chipTextSelected]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.buttonText}>Get started</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 48,
    flexGrow: 1,
  },
  header: {
    marginBottom: 48,
  },
  wordmark: {
    ...Type.labelMd,
    color: Colors.textDisabled,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  title: {
    ...Type.displayMd,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  form: {
    gap: 28,
    marginBottom: 40,
  },
  field: {
    gap: 8,
  },
  label: {
    ...Type.labelMd,
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Type.bodySm,
    color: Colors.error,
  },
  chips: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  chipText: {
    ...Type.labelMd,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  button: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
})
