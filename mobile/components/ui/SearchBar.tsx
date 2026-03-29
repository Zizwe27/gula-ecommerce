import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/typography'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onClear: () => void
  placeholder?: string
}

export function SearchBar({ value, onChangeText, onClear, placeholder = 'Search listings...' }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Feather name="search" size={17} color={Colors.textSecondary} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDisabled}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={styles.clearIcon}>
            <Feather name="x" size={10} color={Colors.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  wrapFocused: {
    borderColor: Colors.black,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
