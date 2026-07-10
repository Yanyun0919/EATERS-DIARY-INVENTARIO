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

// Replaces a store's full set of granted permission keys with exactly `permissionKeys` —
// diffs against what's currently granted and only inserts/deletes what changed, since
// store_permissions has no UPDATE policy (a permission is granted or revoked, not edited).
export async function syncStorePermissions(storeId: string, permissionKeys: string[]) {
  const current = await listStorePermissions(storeId)
  const currentKeys = new Set(current.map((row) => row.permission_key))
  const nextKeys = new Set(permissionKeys)

  const toRemove = current.filter((row) => !nextKeys.has(row.permission_key))
  const toAdd = permissionKeys.filter((key) => !currentKeys.has(key))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('store_permissions')
      .delete()
      .in(
        'id',
        toRemove.map((row) => row.id),
      )
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('store_permissions')
      .insert(toAdd.map((permissionKey) => ({ store_id: storeId, permission_key: permissionKey })))
    if (error) throw error
  }
}

// For the store list's "Operational Capabilities" column — one query for every store rather
// than one query per row.
export async function listAllStorePermissionGrants() {
  const { data, error } = await supabase.from('store_permissions').select('store_id, permission_key')
  if (error) throw error
  return data ?? []
}
