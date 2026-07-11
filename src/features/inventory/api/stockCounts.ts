import { supabase } from '@/core/supabase/client'
import type { StockCountStatus } from '@/core/supabase/database.types'

export interface StockCountFilters {
  storeId?: string
  status?: StockCountStatus
}

export async function listStockCounts(filters: StockCountFilters = {}) {
  let query = supabase.from('stock_counts').select('*').order('started_at', { ascending: false })

  if (filters.storeId) {
    query = query.eq('store_id', filters.storeId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getStockCount(id: string) {
  const { data, error } = await supabase.from('stock_counts').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// The store's current in_progress count, if any — at most one, per Migration 014's unique
// index. Used to decide whether the entry point offers "Iniciar Conteo" or "Continuar Conteo".
export async function getActiveStockCount(storeId: string) {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createStockCount(storeId: string) {
  const { data, error } = await supabase.from('stock_counts').insert({ store_id: storeId }).select().single()
  if (error) throw error
  return data
}

// in_progress -> cancelled only, enforced by RLS (migration 014); nothing is written to
// inventory.
export async function cancelStockCount(id: string) {
  const { error } = await supabase.from('stock_counts').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
}

// Runs complete_stock_count() (migration 014): captures Expected Quantity per item, sets
// Inventory to what was counted, marks the count Completed.
export async function completeStockCount(id: string) {
  const { error } = await supabase.rpc('complete_stock_count', { target_count_id: id })
  if (error) throw error
}

// For the counting screen: counted_quantity only, never expected_quantity/variance -- BUSINESS_
// RULES.md section 3 ("employees should not see the expected/system quantity or variance").
export async function listStockCountItemsForCounting(stockCountId: string) {
  const { data, error } = await supabase
    .from('stock_count_items')
    .select('id, product_id, counted_quantity')
    .eq('stock_count_id', stockCountId)
  if (error) throw error
  return data ?? []
}

// For the Administrator review screen only: full row (expected/counted/variance).
export async function listStockCountItemsForReview(stockCountId: string) {
  const { data, error } = await supabase.from('stock_count_items').select('*').eq('stock_count_id', stockCountId)
  if (error) throw error
  return data ?? []
}

export async function upsertStockCountItem(stockCountId: string, productId: string, countedQuantity: number) {
  const { error } = await supabase
    .from('stock_count_items')
    .upsert(
      { stock_count_id: stockCountId, product_id: productId, counted_quantity: countedQuantity },
      { onConflict: 'stock_count_id,product_id' },
    )
  if (error) throw error
}
