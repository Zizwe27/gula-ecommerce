import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Pressable,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useAuthStore } from '@/stores/auth'
import { useListings, useCategories, ListingFilters } from '@/hooks/useListings'
import { ListingCard } from '@/components/listings/ListingCard'
import { SkeletonCard } from '@/components/listings/SkeletonCard'
import { Feather } from '@expo/vector-icons'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterSheet, FilterState } from '@/components/ui/FilterSheet'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

// Wait 350ms after the user stops typing before querying
function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets()
  const { profile } = useAuthStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [filterState, setFilterState] = useState<FilterState>({
    sort: 'newest',
    priceRange: {},
  })

  const debouncedSearch = useDebounce(search)

  const filters: ListingFilters = {
    search: debouncedSearch || undefined,
    categoryId: selectedCategory ?? undefined,
    sort: filterState.sort,
    minPrice: filterState.priceRange.min,
    maxPrice: filterState.priceRange.max,
  }

  const { data: listings, isLoading, refetch, isRefetching } = useListings(filters)
  const { data: categories } = useCategories()

  const activeFilterCount = [
    filterState.sort !== 'newest',
    filterState.priceRange.min !== undefined || filterState.priceRange.max !== undefined,
  ].filter(Boolean).length

  const skeletons = Array.from({ length: 6 })

  const fixedChrome = (
    <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
      <View style={styles.header}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>
            Good {getTimeOfDay()},{' '}
            <Text style={styles.greetingName}>
              {profile?.display_name?.split(' ')[0] ?? 'there'}
            </Text>
          </Text>
          <Text style={styles.subGreeting}>What are you looking for?</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(app)/edit-profile')}
            activeOpacity={0.8}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchFlex}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterSheetOpen(true)}
          activeOpacity={0.75}
        >
          <Feather
            name="sliders"
            size={18}
            color={activeFilterCount > 0 ? Colors.white : Colors.textSecondary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {/* "All" pill */}
        <Pressable
          style={[styles.categoryPill, selectedCategory === null && styles.categoryPillSelected]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryPillText, selectedCategory === null && styles.categoryPillTextSelected]}>
            All
          </Text>
        </Pressable>

        {categories?.map((cat) => {
          const selected = selectedCategory === cat.id
          return (
            <Pressable
              key={cat.id}
              style={[styles.categoryPill, selected && styles.categoryPillSelected]}
              onPress={() => setSelectedCategory(selected ? null : cat.id)}
            >
              <Text style={[styles.categoryPillText, selected && styles.categoryPillTextSelected]}>
                {cat.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Results count */}
      {!isLoading && listings !== undefined && (
        <Text style={styles.resultsCount}>
          {listings.length === 0
            ? 'No listings found'
            : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}
        </Text>
      )}
      </View>
    </View>
  )

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.screen}>
        {fixedChrome}
        <FlatList
        style={styles.listScroll}
        data={isLoading ? [] : (listings ?? [])}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={[styles.grid, { flexGrow: 1 }]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item, index }) => (
          <ListingCard
            listing={item}
            index={index}
            onPress={() => router.push(`/(app)/listing/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            {isLoading
              ? skeletons.map((_, i) => (
                  <View key={i} style={i % 2 === 0 ? styles.skeletonLeft : null}>
                    <SkeletonCard />
                  </View>
                ))
              : <EmptyState search={search} categorySelected={!!selectedCategory} />
            }
          </View>
        }
        />
      </View>

      <FilterSheet
        visible={filterSheetOpen}
        filters={filterState}
        onChange={setFilterState}
        onClose={() => setFilterSheetOpen(false)}
      />
    </>
  )
}

function EmptyState({ search, categorySelected }: { search: string; categorySelected: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={48} color={Colors.gray300} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>
        {search ? 'No results found' : categorySelected ? 'Nothing here yet' : 'No listings yet'}
      </Text>
      <Text style={styles.emptyBody}>
        {search
          ? `We couldn't find anything for "${search}". Try different keywords.`
          : 'Be the first to list something in this category.'}
      </Text>
    </View>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fixedTop: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    zIndex: 1,
  },
  listScroll: {
    flex: 1,
  },
  // Header (fixed — does not scroll with listings)
  header: {
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
  },
  greetingName: {
    color: Colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  subGreeting: {
    ...Type.h3,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitial: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.white,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  searchFlex: {
    flex: 1,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  filterBtnActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: Colors.white,
    lineHeight: 11,
  },
  categories: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  categoryPillSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  categoryPillText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  categoryPillTextSelected: {
    color: Colors.white,
  },
  resultsCount: {
    ...Type.bodySm,
    color: Colors.textDisabled,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  // Grid
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  row: {
    gap: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  emptyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
  },
  skeletonLeft: {
    // even index cards are in left column
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
    width: '100%',
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyTitle: {
    ...Type.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...Type.bodyMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
