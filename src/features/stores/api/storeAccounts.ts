import { supabase } from '@/core/supabase/client'

export async function listAssignedAccounts(storeId: string) {
  const { data, error } = await supabase.from('staff_stores').select('*').eq('store_id', storeId)
  if (error) throw error
  return data ?? []
}

// Accounts assignable to THIS store -- active profiles not already assigned here. A profile can
// now be assigned to multiple stores (setStaffLocales below), so this is scoped per-store rather
// than "has zero assignments anywhere" the way it was before multi-Locale support.
export async function listAssignableAccounts(storeId: string) {
  const [{ data: profiles, error: profilesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase.from('staff_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('staff_stores').select('staff_profile_id').eq('store_id', storeId),
    ])
  if (profilesError) throw profilesError
  if (assignmentsError) throw assignmentsError

  const assignedIds = new Set((assignments ?? []).map((row) => row.staff_profile_id))
  return (profiles ?? []).filter((profile) => !assignedIds.has(profile.id))
}

// All store_ids currently assigned to a staff member.
export async function listStaffLocales(staffProfileId: string) {
  const { data, error } = await supabase.from('staff_stores').select('store_id').eq('staff_profile_id', staffProfileId)
  if (error) throw error
  return (data ?? []).map((row) => row.store_id)
}

// Replaces a staff member's full set of assigned Locales with exactly `storeIds` -- diffs against
// what's currently assigned and only inserts/deletes what changed. This is the one function that
// writes staff_stores now; both the Store's own Cuentas de Acceso editor and the Staff module's
// Locales editor go through it, so "assign this account to a store" is always expressed as "this
// account's full store set is now X" rather than a special-cased single-row operation.
export async function setStaffLocales(staffProfileId: string, storeIds: string[]) {
  const currentIds = await listStaffLocales(staffProfileId)
  const currentSet = new Set(currentIds)
  const nextSet = new Set(storeIds)

  const toRemove = currentIds.filter((id) => !nextSet.has(id))
  const toAdd = storeIds.filter((id) => !currentSet.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('staff_stores')
      .delete()
      .eq('staff_profile_id', staffProfileId)
      .in('store_id', toRemove)
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('staff_stores')
      .insert(toAdd.map((storeId) => ({ staff_profile_id: staffProfileId, store_id: storeId })))
    if (error) throw error
  }
}

// For the store list's "Cuentas de Acceso" column — one query for every store rather than one
// query per row.
export async function listAllStoreAccountAssignments() {
  const { data, error } = await supabase.from('staff_stores').select('store_id, staff_profile_id')
  if (error) throw error
  return data ?? []
}

// Name lookups for both the store list's "Cuentas de Acceso" column and the store form's
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

// The first store a non-administrator account is assigned to -- used by operational modules like
// Inventory to skip a store picker for staff who only have one store to work with. Known
// limitation now that multi-Locale assignment is real: for a staff member assigned to more than
// one store, this returns only one of them (no deterministic order), and the consuming pages
// (CurrentInventoryPage, StockCountListPage) have no UI to switch between the others. Not fixed
// as part of this change -- flagged, not silently left undiscovered.
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
