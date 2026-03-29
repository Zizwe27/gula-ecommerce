import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Listing } from '@/types/database'

export type SortOption = 'newest' | 'price_asc' | 'price_desc'

export interface ListingFilters {
  categoryId?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  sort?: SortOption
}

export type ListingWithRelations = Listing & {
  seller: { id: string; display_name: string; shop_name: string | null; location: string | null }
  category: { id: string; name: string; slug: string; icon: string | null }
}

export function useListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async (): Promise<ListingWithRelations[]> => {
      let query = supabase
        .from('listings')
        .select(`
          *,
          seller:profiles(id, display_name, shop_name, location),
          category:categories(id, name, slug, icon)
        `)
        .eq('status', 'active')

      if (filters.categoryId)
        query = query.eq('category_id', filters.categoryId)
      if (filters.search?.trim())
        query = query.ilike('title', `%${filters.search.trim()}%`)
      if (filters.minPrice !== undefined)
        query = query.gte('price_zmw', filters.minPrice)
      if (filters.maxPrice !== undefined)
        query = query.lte('price_zmw', filters.maxPrice)

      if (filters.sort === 'price_asc')
        query = query.order('price_zmw', { ascending: true })
      else if (filters.sort === 'price_desc')
        query = query.order('price_zmw', { ascending: false })
      else
        query = query.order('created_at', { ascending: false })

      const { data, error } = await query.range(0, 39)
      if (error) throw error
      return (data ?? []) as ListingWithRelations[]
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
    staleTime: Infinity, // categories never change at runtime
  })
}
