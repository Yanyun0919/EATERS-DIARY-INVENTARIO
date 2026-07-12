import { supabase } from '@/core/supabase/client'

export async function listStoreRoleDefinitions() {
  const { data, error } = await supabase
    .from('store_role_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listStoreRoles(storeId: string) {
  const { data, error } = await supabase.from('store_roles').select('*').eq('store_id', storeId)
  if (error) throw error
  return data ?? []
}

export async function assignStoreRole(storeId: string, roleKey: string) {
  const { error } = await supabase.from('store_roles').insert({ store_id: storeId, role_key: roleKey })
  if (error) throw error
}

export async function removeStoreRole(storeId: string, roleKey: string) {
  const { error } = await supabase.from('store_roles').delete().eq('store_id', storeId).eq('role_key', roleKey)
  if (error) throw error
}

// For the store list's Role badges -- one query for every store rather than one query per row.
export async function listAllStoreRoles() {
  const { data, error } = await supabase.from('store_roles').select('store_id, role_key')
  if (error) throw error
  return data ?? []
}
