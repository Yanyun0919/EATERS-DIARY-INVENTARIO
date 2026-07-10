import { supabase } from '@/core/supabase/client'
import type { PurchaseUnitType } from '@/core/supabase/database.types'

// Minimal product lookup for the "add product" picker — Suppliers reads the shared `products`
// table directly rather than importing from the Products feature, same pattern Products uses
// to read categories/units/suppliers.
export async function listProductsForPicker() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, base_unit_id')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listProductsSuppliedBy(supplierId: string) {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('is_preferred', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface ProductSupplierInput {
  id?: string
  supplierId: string
  productId: string
  supplierSku: string | null
  unitPrice: number
  purchaseUnit: PurchaseUnitType
  purchaseUnitSpec: string | null
  moq: number
  leadTimeDays: number | null
  ivaRate: number
  isPreferred: boolean
  isAvailable: boolean
}

export async function upsertProductSupplier(input: ProductSupplierInput) {
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
    purchase_unit: input.purchaseUnit,
    purchase_unit_spec: input.purchaseUnitSpec,
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

export async function deleteProductSupplier(id: string) {
  const { error } = await supabase.from('supplier_products').delete().eq('id', id)
  if (error) throw error
}
