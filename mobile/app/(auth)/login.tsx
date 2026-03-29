import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('260')) return `+${digits}`
    if (digits.startsWith('0')) return `+260${digits.slice(1)}`
    return `+260${digits}`
  }

  const handleSendOTP = async () => {
    setError('')
    const formatted = formatPhone(phone)
    if (formatted.length < 12) {
      setError('Enter a valid Zambian phone number')
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if (authError) { setError(authError.message); return }
    router.push({ pathname: '/(auth)/verify', params: { phone: formatted } })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.inner}>
        {/* Wordmark */}
        <Text style={styles.wordmark}>gula.</Text>
        <Text style={styles.tagline}>buy and sell with confidence</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>

          <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
            <Text style={styles.prefix}>+260</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="97 123 4567"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => { setError(''); setPhone(t) }}
              maxLength={15}
              autoFocus
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          A verification code will be sent via SMS.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  wordmark: {
    ...Type.displayLg,
    color: Colors.black,
    marginBottom: 6,
  },
  tagline: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    marginBottom: 56,
  },
  form: {
    gap: 12,
  },
  label: {
    ...Type.labelMd,
    color: Colors.textPrimary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: Colors.white,
  },
  inputWrapError: {
    borderColor: Colors.error,
  },
  prefix: {
    ...Type.bodyLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
  },
  error: {
    ...Type.bodySm,
    color: Colors.error,
    marginTop: -4,
  },
  button: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  disclaimer: {
    ...Type.caption,
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: 40,
  },
})
