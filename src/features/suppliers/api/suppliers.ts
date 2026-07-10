import { supabase } from '@/core/supabase/client'

export interface SupplierFilters {
  search?: string
  isActive?: boolean
}

export interface SupplierInput {
  name: string
  nifCif: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  paymentTerms: string | null
}

export async function listSuppliers(filters: SupplierFilters = {}) {
  let query = supabase.from('suppliers').select('*').order('name', { ascending: true })

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

export async function getSupplier(id: string) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

function toSupplierPayload(input: SupplierInput) {
  return {
    name: input.name,
    nif_cif: input.nifCif,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    payment_terms: input.paymentTerms,
  }
}

export async function createSupplier(input: SupplierInput) {
  const { data, error } = await supabase.from('suppliers').insert(toSupplierPayload(input)).select().single()
  if (error) throw error
  return data
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const { data, error } = await supabase
    .from('suppliers')
    .update(toSupplierPayload(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setSupplierActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('suppliers').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
