import { supabase } from '@/core/supabase/client'
import type { SupplySourceResolutionType } from '@/core/supabase/database.types'

export interface SupplySourceFilters {
  search?: string
  isActive?: boolean
}

export interface SupplySourceInput {
  name: string
  resolutionType: SupplySourceResolutionType
  sortOrder: number
  isActive: boolean
  // Required when resolutionType is 'internal', ignored otherwise -- an 'external' source
  // never has a locale config row (migration 025).
  storeId: string | null
}

export async function listSupplySources(filters: SupplySourceFilters = {}) {
  let query = supabase.from('supply_sources').select('*').order('sort_order', { ascending: true }).order('name')

  if (filters.search?.trim()) {
    query = query.ilike('name', `%${filters.search.trim()}%`)
  }
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getSupplySource(id: string) {
  const { data, error } = await supabase.from('supply_sources').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Returns null for 'external'-type sources, which never have a config row.
export async function getSupplySourceLocaleConfig(supplySourceId: string) {
  const { data, error } = await supabase
    .from('supply_source_locale_config')
    .select('*')
    .eq('supply_source_id', supplySourceId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Keeps supply_sources and its optional supply_source_locale_config row in lockstep --
// application-layer responsibility per the approved Technical Design: an 'internal' source
// always has exactly one config row, an 'external' source always has none. Two statements,
// not a single database transaction -- same pattern already used for other multi-table
// Master Data writes that aren't themselves a single business event (e.g. createStaffAccount).
async function syncSupplySourceLocaleConfig(supplySourceId: string, input: SupplySourceInput) {
  if (input.resolutionType === 'internal') {
    if (!input.storeId) throw new Error('A Locale is required for an internal Supply Source.')
    const { error } = await supabase
      .from('supply_source_locale_config')
      .upsert({ supply_source_id: supplySourceId, store_id: input.storeId }, { onConflict: 'supply_source_id' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('supply_source_locale_config').delete().eq('supply_source_id', supplySourceId)
    if (error) throw error
  }
}

export async function createSupplySource(input: SupplySourceInput) {
  const { data, error } = await supabase
    .from('supply_sources')
    .insert({
      name: input.name,
      resolution_type: input.resolutionType,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select()
    .single()
  if (error) throw error

  await syncSupplySourceLocaleConfig(data.id, input)
  return data
}

export async function updateSupplySource(id: string, input: SupplySourceInput) {
  const { data, error } = await supabase
    .from('supply_sources')
    .update({
      name: input.name,
      resolution_type: input.resolutionType,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await syncSupplySourceLocaleConfig(id, input)
  return data
}

export async function setSupplySourceActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('supply_sources').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

// Locale picker for an 'internal' Supply Source -- scoped to stores holding the
// production_center Store Role. Enforced here at the application layer only, matching the
// exact precedent already set by internal_products.default_production_center_id (migration
// 009) -- not a database constraint.
export async function listProductionCenterStores() {
  const { data: roles, error: rolesError } = await supabase
    .from('store_roles')
    .select('store_id')
    .eq('role_key', 'production_center')
  if (rolesError) throw rolesError

  const storeIds = (roles ?? []).map((role) => role.store_id)
  if (storeIds.length === 0) return []

  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('*')
    .in('id', storeIds)
    .order('name')
  if (storesError) throw storesError
  return stores ?? []
}
