import { supabase } from '@/core/supabase/client'

export async function listStaffPermissionDefinitions() {
  const { data, error } = await supabase
    .from('staff_permission_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listStaffPermissions(staffProfileId: string) {
  const { data, error } = await supabase.from('staff_permissions').select('*').eq('staff_profile_id', staffProfileId)
  if (error) throw error
  return data ?? []
}

export async function grantStaffPermission(staffProfileId: string, permissionKey: string) {
  const { error } = await supabase
    .from('staff_permissions')
    .insert({ staff_profile_id: staffProfileId, permission_key: permissionKey })
  if (error) throw error
}

export async function revokeStaffPermission(staffProfileId: string, permissionKey: string) {
  const { error } = await supabase
    .from('staff_permissions')
    .delete()
    .eq('staff_profile_id', staffProfileId)
    .eq('permission_key', permissionKey)
  if (error) throw error
}
