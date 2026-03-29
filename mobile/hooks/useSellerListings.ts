import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ListingWithRelations } from './useListings'

export function useSellerListings(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-listings', sellerId],
    queryFn: async (): Promise<ListingWithRelations[]> => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          seller:profiles(id, display_name, shop_name, location),
          category:categories(id, name, slug, icon)
        `)
        .eq('seller_id', sellerId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ListingWithRelations[]
    },
    enabled: !!sellerId,
  })
}
