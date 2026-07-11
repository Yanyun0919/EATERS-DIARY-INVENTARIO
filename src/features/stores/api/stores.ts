import { supabase } from '@/core/supabase/client'
import type { StoreType } from '@/core/supabase/database.types'

export interface StoreFilters {
  search?: string
  isActive?: boolean
}

export interface StoreInput {
  brandId: string
  name: string
  code: string
  type: StoreType
  address: string | null
  isActive: boolean
}

export async function listStores(filters: StoreFilters = {}) {
  let query = supabase.from('stores').select('*').order('name', { ascending: true })

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

export async function getStore(id: string) {
  const { data, error } = await supabase.from('stores').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

function toStorePayload(input: StoreInput) {
  return {
    brand_id: input.brandId,
    name: input.name,
    code: input.code,
    type: input.type,
    address: input.address,
    is_active: input.isActive,
  }
}

export async function createStore(input: StoreInput) {
  const { data, error } = await supabase.from('stores').insert(toStorePayload(input)).select().single()
  if (error) throw error
  return data
}

export async function updateStore(id: string, input: StoreInput) {
  const { data, error } = await supabase.from('stores').update(toStorePayload(input)).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setStoreActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('stores').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
