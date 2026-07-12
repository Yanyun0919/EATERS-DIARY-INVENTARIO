import { supabase } from '@/core/supabase/client'

export async function listPermissionDefinitions() {
  const { data, error } = await supabase
    .from('permission_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listStorePermissions(storeId: string) {
  const { data, error } = await supabase.from('store_permissions').select('*').eq('store_id', storeId)
  if (error) throw error
  return data ?? []
}

// store_permissions rows themselves are only ever written by the sync_store_permissions_from_roles
// trigger (migration 019), driven by store_roles changes -- the one manual write left is toggling
// Operational Status. INSERT/DELETE grants were revoked from `authenticated` in that migration.
export async function updatePermissionEnabled(storeId: string, permissionKey: string, isEnabled: boolean) {
  const { error } = await supabase
    .from('store_permissions')
    .update({ is_enabled: isEnabled })
    .eq('store_id', storeId)
    .eq('permission_key', permissionKey)
  if (error) throw error
}

// For the store list's "Operational Capabilities" column — one query for every store rather
// than one query per row.
export async function listAllStorePermissionGrants() {
  const { data, error } = await supabase.from('store_permissions').select('store_id, permission_key')
  if (error) throw error
  return data ?? []
}
