import { supabase } from '@/core/supabase/client'

export async function listAssignedAccounts(storeId: string) {
  const { data, error } = await supabase.from('staff_stores').select('*').eq('store_id', storeId)
  if (error) throw error
  return data ?? []
}

// Accounts not currently assigned to any store — the pool available to assign here. A login
// account belongs to at most one store, enforced at the application layer (see
// assignAccountToStore below), not by a database constraint.
export async function listUnassignedAccounts() {
  const [{ data: profiles, error: profilesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('staff_stores').select('staff_profile_id'),
    ])
  if (profilesError) throw profilesError
  if (assignmentsError) throw assignmentsError

  const assignedIds = new Set((assignments ?? []).map((row) => row.staff_profile_id))
  return (profiles ?? []).filter((profile) => !assignedIds.has(profile.id))
}

// A login account belongs to one store — assigning it here first clears any existing
// assignment elsewhere, so this also serves as "move this account to a different store."
export async function assignAccountToStore(storeId: string, staffProfileId: string) {
  const { error: deleteError } = await supabase
    .from('staff_stores')
    .delete()
    .eq('staff_profile_id', staffProfileId)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabase
    .from('staff_stores')
    .insert({ store_id: storeId, staff_profile_id: staffProfileId })
  if (insertError) throw insertError
}

export async function removeAccountFromStore(staffStoreId: string) {
  const { error } = await supabase.from('staff_stores').delete().eq('id', staffStoreId)
  if (error) throw error
}

// For the store list's "Assigned Login Account(s)" column.
export async function listAllStoreAccountAssignments() {
  const { data, error } = await supabase.from('staff_stores').select('store_id, staff_profile_id')
  if (error) throw error
  return data ?? []
}

// Name lookups for both the store list's "Login Account(s)" column and the store form's
// assigned-accounts editor.
export async function listAllStaffProfiles() {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return data ?? []
}

// The store a non-administrator account is assigned to (at most one, per the one-account-one-
// store rule) — used by operational modules like Inventory to skip a store picker entirely for
// staff who only ever have one store to work with.
export async function getMyStore(staffProfileId: string) {
  const { data: assignment, error: assignmentError } = await supabase
    .from('staff_stores')
    .select('store_id')
    .eq('staff_profile_id', staffProfileId)
    .limit(1)
    .maybeSingle()
  if (assignmentError) throw assignmentError
  if (!assignment) return null

  const { data: store, error } = await supabase.from('stores').select('*').eq('id', assignment.store_id).single()
  if (error) throw error
  return store
}
