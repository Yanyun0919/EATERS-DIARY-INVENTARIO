import { supabase } from '@/core/supabase/client'
import type { ProductAliasType } from '@/core/supabase/database.types'

export async function listSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return data ?? []
}

export async function listSupplierProducts(productId: string) {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*')
    .eq('product_id', productId)
    .order('is_preferred', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface SupplierProductInput {
  id?: string
  supplierId: string
  productId: string
  supplierSku: string | null
  unitPrice: number
  purchaseUnitId: string
  moq: number
  leadTimeDays: number | null
  ivaRate: number
  isPreferred: boolean
  isAvailable: boolean
}

export async function upsertSupplierProduct(input: SupplierProductInput) {
  // only one preferred supplier per product is allowed at the DB level (partial unique
  // index) — clear the existing one first so marking a new preferred supplier doesn't
  // surface a constraint-violation error to the user
  if (input.isPreferred) {
    let clearQuery = supabase
      .from('supplier_products')
      .update({ is_preferred: false })
      .eq('product_id', input.productId)
      .eq('is_preferred', true)
    if (input.id) clearQuery = clearQuery.neq('id', input.id)
    const { error: clearError } = await clearQuery
    if (clearError) throw clearError
  }

  const payload = {
    supplier_id: input.supplierId,
    product_id: input.productId,
    supplier_sku: input.supplierSku,
    unit_price: input.unitPrice,
    purchase_unit_id: input.purchaseUnitId,
    moq: input.moq,
    lead_time_days: input.leadTimeDays,
    iva_rate: input.ivaRate,
    is_preferred: input.isPreferred,
    is_available: input.isAvailable,
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('supplier_products')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase.from('supplier_products').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteSupplierProduct(id: string) {
  const { error } = await supabase.from('supplier_products').delete().eq('id', id)
  if (error) throw error
}

export async function listUnitConversions(productId: string) {
  const { data, error } = await supabase
    .from('product_unit_conversions')
    .select('*')
    .eq('product_id', productId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export interface UnitConversionInput {
  id?: string
  productId: string
  fromUnitId: string
  toUnitId: string
  factor: number
}

export async function upsertUnitConversion(input: UnitConversionInput) {
  const payload = {
    product_id: input.productId,
    from_unit_id: input.fromUnitId,
    to_unit_id: input.toUnitId,
    factor: input.factor,
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('product_unit_conversions')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase.from('product_unit_conversions').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteUnitConversion(id: string) {
  const { error } = await supabase.from('product_unit_conversions').delete().eq('id', id)
  if (error) throw error
}

export async function listAliases(productId: string) {
  const { data, error } = await supabase
    .from('product_aliases')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('alias_type')
  if (error) throw error
  return data ?? []
}

export interface AliasInput {
  id?: string
  productId: string
  alias: string
  aliasType: ProductAliasType
  languageCode: string | null
}

export async function upsertAlias(input: AliasInput) {
  const payload = {
    product_id: input.productId,
    alias: input.alias,
    alias_type: input.aliasType,
    language_code: input.languageCode,
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('product_aliases')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase.from('product_aliases').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteAlias(id: string) {
  const { error } = await supabase.from('product_aliases').delete().eq('id', id)
  if (error) throw error
}
