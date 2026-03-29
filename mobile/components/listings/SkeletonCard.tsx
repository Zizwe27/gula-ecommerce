import { View, StyleSheet, Animated, Dimensions } from 'react-native'
import { useEffect, useRef } from 'react'
import { Colors } from '@/constants/colors'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2

function ShimmerBox({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return <Animated.View style={[style, { opacity }]} />
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <ShimmerBox style={styles.image} />
      <View style={styles.content}>
        <ShimmerBox style={styles.titleLine1} />
        <ShimmerBox style={styles.titleLine2} />
        <ShimmerBox style={styles.metaLine} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: CARD_WIDTH,
    backgroundColor: Colors.gray200,
  },
  content: {
    padding: 10,
    gap: 7,
  },
  titleLine1: {
    height: 12,
    backgroundColor: Colors.gray200,
    borderRadius: 6,
    width: '90%',
  },
  titleLine2: {
    height: 12,
    backgroundColor: Colors.gray200,
    borderRadius: 6,
    width: '65%',
  },
  metaLine: {
    height: 10,
    backgroundColor: Colors.gray100,
    borderRadius: 5,
    width: '50%',
    marginTop: 2,
  },
})
