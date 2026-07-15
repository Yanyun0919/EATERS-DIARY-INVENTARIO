import { supabase } from '@/core/supabase/client'
import type { Database, PurchaseUnitType } from '@/core/supabase/database.types'

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']

export interface PurchaseOrderFilters {
  storeId?: string
  supplierId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface PurchaseOrderWithTotal extends PurchaseOrder {
  total: number
}

// Resolves which purchase_orders match a search term across Supplier Name, Product Name, and
// Notes. Three separate ilike queries (each a proper parameterized method call, not a
// hand-built .or() filter string that could break on a comma or parenthesis in a real supplier
// or product name), merged and de-duplicated here -- the actual text matching happens in
// Postgres, not by fetching everything and filtering in JS.
async function listPurchaseOrderIdsMatchingSearch(term: string): Promise<string[]> {
  const [bySupplierName, byNotes, byProductName] = await Promise.all([
    supabase.from('purchase_orders').select('id').ilike('supplier_name', `%${term}%`),
    supabase.from('purchase_orders').select('id').ilike('notes', `%${term}%`),
    supabase.from('purchase_order_items').select('purchase_order_id').ilike('product_name', `%${term}%`),
  ])
  if (bySupplierName.error) throw bySupplierName.error
  if (byNotes.error) throw byNotes.error
  if (byProductName.error) throw byProductName.error

  const ids = new Set<string>()
  for (const row of bySupplierName.data ?? []) ids.add(row.id)
  for (const row of byNotes.data ?? []) ids.add(row.id)
  for (const row of byProductName.data ?? []) ids.add(row.purchase_order_id)
  return [...ids]
}

export async function listPurchaseOrders(filters: PurchaseOrderFilters = {}) {
  const term = filters.search?.trim()
  let matchingOrderIds: string[] | null = null

  if (term) {
    matchingOrderIds = await listPurchaseOrderIdsMatchingSearch(term)
    if (matchingOrderIds.length === 0) return []
  }

  let query = supabase
    .from('purchase_orders')
    .select('*')
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.storeId) {
    query = query.eq('store_id', filters.storeId)
  }
  if (filters.supplierId) {
    query = query.eq('supplier_id', filters.supplierId)
  }
  if (filters.dateFrom) {
    query = query.gte('order_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('order_date', filters.dateTo)
  }
  if (matchingOrderIds) {
    query = query.in('id', matchingOrderIds)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function listPurchaseOrderItemTotals(purchaseOrderIds: string[]) {
  if (purchaseOrderIds.length === 0) return []
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('purchase_order_id, line_total')
    .in('purchase_order_id', purchaseOrderIds)
  if (error) throw error
  return data ?? []
}

// One extra query on top of listPurchaseOrders (for line_total), regardless of how many
// purchases are in the list -- never one query per row.
export async function listPurchaseOrdersWithTotals(filters: PurchaseOrderFilters = {}): Promise<PurchaseOrderWithTotal[]> {
  const orders = await listPurchaseOrders(filters)
  const items = await listPurchaseOrderItemTotals(orders.map((order) => order.id))

  const totalsByOrderId = new Map<string, number>()
  for (const item of items) {
    totalsByOrderId.set(item.purchase_order_id, (totalsByOrderId.get(item.purchase_order_id) ?? 0) + Number(item.line_total))
  }

  return orders.map((order) => ({ ...order, total: totalsByOrderId.get(order.id) ?? 0 }))
}

export interface PurchaseOrderDetail {
  order: PurchaseOrder
  items: PurchaseOrderItem[]
}

// Page 3 (Purchase Detail) -- a single read, no joins to suppliers/products/supplier_products
// needed, since every field it displays (supplier_name, product_name, purchase_unit,
// purchase_unit_spec, unit_price, iva_rate) is already a snapshot on these rows (migrations
// 015/016). Store name and Creado Por (staff full_name) are resolved by the caller from the
// stores/staff_profiles data it already has loaded, same pattern as StockCountDetailPage.
export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const { data: order, error: orderError } = await supabase.from('purchase_orders').select('*').eq('id', id).maybeSingle()
  if (orderError) throw orderError
  if (!order) return null

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', id)
    .order('created_at', { ascending: true })
  if (itemsError) throw itemsError

  return { order, items: items ?? [] }
}

export interface NewPurchaseOrderItemInput {
  productId: string
  productName: string
  supplierProductId: string
  quantityOrdered: number
  unitPrice: number
  ivaRate: number
  purchaseUnit: PurchaseUnitType
  purchaseUnitSpec: string | null
}

export interface NewPurchaseOrderInput {
  storeId: string
  supplierId: string
  notes: string | null
  items: NewPurchaseOrderItemInput[]
}

// create_purchase_order() (migration 017) is the sole write path for both tables -- a single
// security-definer transaction, same design philosophy as complete_stock_count(). It resolves
// supplier_name/product_name/purchase_unit/purchase_unit_spec itself from current data at the
// moment of the transaction, rather than trusting client-supplied values that could already be
// stale (e.g. a rename between opening this form and submitting it) -- so only quantity/price/
// IVA are sent here, since those are the manager's actual decision, not a value to re-derive.
// created_by is resolved server-side too, from the caller's own session.
export async function createPurchaseOrder(input: NewPurchaseOrderInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase_order', {
    target_store_id: input.storeId,
    target_supplier_id: input.supplierId,
    target_notes: input.notes,
    target_items: input.items.map((item) => ({
      product_id: item.productId,
      supplier_product_id: item.supplierProductId,
      quantity_ordered: item.quantityOrdered,
      unit_price: item.unitPrice,
      iva_rate: item.ivaRate,
    })),
  })
  if (error) throw error
  return data
}
