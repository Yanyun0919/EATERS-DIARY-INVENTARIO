import { supabase } from '@/core/supabase/client'

// Brand is not an independent business module -- it exists only to support Store creation, so
// this only covers what the Store form actually needs: listing brands for the selector, and
// creating one from the inline "Nueva Marca" dialog. No update/delete -- there's no UI surface
// for either.
export interface BrandInput {
  name: string
  isActive: boolean
}

export async function listBrands(isActive?: boolean) {
  let query = supabase.from('brands').select('*').order('name')
  if (isActive !== undefined) {
    query = query.eq('is_active', isActive)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createBrand(input: BrandInput) {
  const { data, error } = await supabase
    .from('brands')
    .insert({ name: input.name, is_active: input.isActive })
    .select()
    .single()
  if (error) throw error
  return data
}
