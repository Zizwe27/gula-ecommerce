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
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    setError('')
    if (otp.length < 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    const { error: authError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (authError) { setError('Invalid or expired code. Try again.'); return }
    // onAuthStateChange in _layout.tsx handles redirect
  }

  const handleResend = async () => {
    setError('')
    setResending(true)
    await supabase.auth.signInWithOtp({ phone })
    setResending(false)
    setOtp('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.inner}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Check your{'\n'}messages</Text>
        <Text style={styles.subtitle}>
          Code sent to{' '}
          <Text style={styles.phoneHighlight}>{phone}</Text>
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.otpInput, error ? styles.otpInputError : null]}
            placeholder="------"
            placeholderTextColor={Colors.gray300}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(t) => { setError(''); setOtp(t) }}
            autoFocus
            textAlign="center"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Verify</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resend}
          onPress={handleResend}
          disabled={resending}
        >
          <Text style={styles.resendText}>
            {resending ? 'Sending...' : "Didn't receive a code? Resend"}
          </Text>
        </TouchableOpacity>
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
    paddingTop: 64,
  },
  back: {
    marginBottom: 40,
    alignSelf: 'flex-start',
  },
  backText: {
    ...Type.labelLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  title: {
    ...Type.h1,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    marginBottom: 48,
  },
  phoneHighlight: {
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  form: {
    gap: 12,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 72,
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: 16,
    backgroundColor: Colors.surface,
  },
  otpInputError: {
    borderColor: Colors.error,
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
  resend: {
    marginTop: 32,
    alignItems: 'center',
  },
  resendText: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
    textDecorationLine: 'underline',
  },
})
