import { supabase } from '@/core/supabase/client'

export interface ProductFilters {
  search?: string
  categoryId?: string | null
  isActive?: boolean
}

export interface ProductInput {
  name: string
  sku: string | null
  categoryId: string | null
  baseUnitId: string
  isStockTracked: boolean
}

function escapeIlikeTerm(term: string) {
  return term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function listProducts(filters: ProductFilters = {}) {
  let query = supabase.from('products').select('*').order('name', { ascending: true })

  if (filters.search?.trim()) {
    const term = escapeIlikeTerm(filters.search.trim())
    query = query.or(`name.ilike."%${term}%",sku.ilike."%${term}%"`)
  }
  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProduct(id: string) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createProduct(input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      sku: input.sku,
      category_id: input.categoryId,
      base_unit_id: input.baseUnitId,
      is_stock_tracked: input.isStockTracked,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .update({
      name: input.name,
      sku: input.sku,
      category_id: input.categoryId,
      base_unit_id: input.baseUnitId,
      is_stock_tracked: input.isStockTracked,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setProductActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function listCategories() {
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return data ?? []
}

export async function listUnits() {
  const { data, error } = await supabase.from('units').select('*').order('name')
  if (error) throw error
  return data ?? []
}
