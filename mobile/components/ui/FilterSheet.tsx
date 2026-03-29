import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated as RNAnimated,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native'
import { useEffect, useRef } from 'react'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'
import { SortOption } from '@/hooks/useListings'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6

export interface FilterState {
  sort: SortOption
  priceRange: { min?: number; max?: number }
}

interface Props {
  visible: boolean
  filters: FilterState
  onChange: (filters: FilterState) => void
  onClose: () => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_asc',  label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any price' },
  { label: 'Under K100',      max: 100 },
  { label: 'K100 – K500',     min: 100,  max: 500 },
  { label: 'K500 – K1,000',   min: 500,  max: 1000 },
  { label: 'K1,000 – K5,000', min: 1000, max: 5000 },
  { label: 'Over K5,000',     min: 5000 },
]

export function FilterSheet({ visible, filters, onChange, onClose }: Props) {
  const translateY = useRef(new RNAnimated.Value(SHEET_HEIGHT)).current

  useEffect(() => {
    RNAnimated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
    }).start()
  }, [visible])

  const activePreset = PRICE_PRESETS.findIndex(p =>
    p.min === filters.priceRange.min && p.max === filters.priceRange.max
  )

  const handleReset = () => {
    onChange({ sort: 'newest', priceRange: {} })
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <RNAnimated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sort & Filter</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {/* Sort */}
          <Text style={styles.sectionLabel}>Sort by</Text>
          <View style={styles.optionGroup}>
            {SORT_OPTIONS.map((opt, i) => {
              const selected = filters.sort === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionRow,
                    i < SORT_OPTIONS.length - 1 && styles.optionRowBorder,
                  ]}
                  onPress={() => onChange({ ...filters, sort: opt.value })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Price range */}
          <Text style={styles.sectionLabel}>Price range</Text>
          <View style={styles.priceGrid}>
            {PRICE_PRESETS.map((preset, i) => {
              const selected = i === (activePreset === -1 ? 0 : activePreset)
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.priceChip, selected && styles.priceChipSelected]}
                  onPress={() => onChange({ ...filters, priceRange: { min: preset.min, max: preset.max } })}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.priceChipText, selected && styles.priceChipTextSelected]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View style={styles.applyWrap}>
          <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </RNAnimated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sheetTitle: {
    ...Type.h3,
    color: Colors.textPrimary,
  },
  resetText: {
    ...Type.labelMd,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
    textDecorationLine: 'underline',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  sectionLabel: {
    ...Type.labelSm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  optionGroup: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionLabel: {
    ...Type.bodyLg,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
  },
  optionLabelSelected: {
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.black,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.black,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  priceChipSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  priceChipText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  priceChipTextSelected: {
    color: Colors.white,
    fontFamily: Fonts.medium,
  },
  applyWrap: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  applyBtn: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    ...Type.labelLg,
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
})
