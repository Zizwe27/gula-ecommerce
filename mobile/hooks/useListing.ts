import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ListingWithRelations } from './useListings'

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async (): Promise<ListingWithRelations> => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          seller:profiles(id, display_name, shop_name, location, avatar_url),
          category:categories(id, name, slug, icon)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as ListingWithRelations
    },
    enabled: !!id,
  })
}
