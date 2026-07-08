import { useEffect, useState } from 'react'
import { supabase } from '@/core/supabase/client'
import type { StaffRole } from '@/core/supabase/database.types'
import { useAuth } from '@/core/auth/useAuth'

interface StaffProfile {
  id: string
  fullName: string
  role: StaffRole
}

export function useStaffProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('staff_profiles')
      .select('id, full_name, role')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setProfile(data ? { id: data.id, fullName: data.full_name, role: data.role } : null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const canWriteMasterData = profile?.role === 'admin' || profile?.role === 'manager'

  return { profile, loading, canWriteMasterData }
}
