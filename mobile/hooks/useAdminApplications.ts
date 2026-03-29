import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SellerApplication = {
  id: string
  user_id: string
  seller_name: string
  description: string
  location: string
  id_type: string
  id_number: string
  mobile_money_provider: string
  mobile_money_number: string
  id_document_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  profile: {
    display_name: string
    phone: string
    avatar_url: string | null
  } | null
}

export function useAdminApplications(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  return useQuery({
    queryKey: ['admin-applications', status],
    queryFn: async (): Promise<SellerApplication[]> => {
      const { data, error } = await supabase
        .from('seller_applications')
        .select(`
          *,
          profile:profiles!seller_applications_user_id_fkey(display_name, phone, avatar_url)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SellerApplication[]
    },
  })
}

export function useAdminApplication(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-application', id],
    queryFn: async (): Promise<SellerApplication> => {
      const { data, error } = await supabase
        .from('seller_applications')
        .select(`
          *,
          profile:profiles!seller_applications_user_id_fkey(display_name, phone, avatar_url)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as SellerApplication
    },
    enabled: !!id,
  })
}

export function useReviewApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      applicationId,
      userId,
      action,
      rejectionReason,
      shopName,
    }: {
      applicationId: string
      userId: string
      action: 'approve' | 'reject'
      rejectionReason?: string
      shopName?: string
    }) => {
      // Update application status
      const { error: appError } = await supabase
        .from('seller_applications')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          rejection_reason: action === 'reject' ? (rejectionReason ?? null) : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)

      if (appError) throw appError

      // Update user's seller_status (and optionally shop_name)
      const profileUpdates: Record<string, string | null> = {
        seller_status: action === 'approve' ? 'approved' : 'rejected',
      }
      if (action === 'approve' && shopName) {
        profileUpdates.shop_name = shopName
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId)

      if (profileError) throw profileError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-application'] })
    },
  })
}
