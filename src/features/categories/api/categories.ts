import { supabase } from '@/core/supabase/client'

export interface CategoryFilters {
  search?: string
  isActive?: boolean
}

export interface CategoryInput {
  name: string
  sortOrder: number
  isActive: boolean
}

export async function listCategories(filters: CategoryFilters = {}) {
  let query = supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name')

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

export async function getCategory(id: string) {
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCategory(input: CategoryInput) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: input.name, sort_order: input.sortOrder, is_active: input.isActive })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, input: CategoryInput) {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: input.name, sort_order: input.sortOrder, is_active: input.isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setCategoryActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
