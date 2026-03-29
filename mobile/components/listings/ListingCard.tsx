import { View, Text, StyleSheet, Pressable, Dimensions, Animated } from 'react-native'
import { useRef } from 'react'
import { Image } from 'expo-image'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/typography'
import { ListingWithRelations } from '@/hooks/useListings'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2

interface Props {
  listing: ListingWithRelations
  index: number
  onPress: () => void
}

export function ListingCard({ listing, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start()
  }

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start()
  }

  const sellerName = listing.seller?.shop_name || listing.seller?.display_name || 'Seller'
  const location = listing.seller?.location
  const firstImage = listing.images?.[0]

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          <Image
            source={firstImage ? { uri: firstImage } : require('@/assets/listing-placeholder.png')}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
          {/* Price badge */}
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>K {Number(listing.price_zmw).toLocaleString()}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
            {location ? (
              <Text style={styles.location} numberOfLines={1}> · {location}</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  imageWrap: {
    width: '100%',
    height: CARD_WIDTH,
    backgroundColor: Colors.gray100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: Colors.black,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priceText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  content: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  location: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    flexShrink: 0,
  },
})
