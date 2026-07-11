import { supabase } from '@/core/supabase/client'

// All active, stock-tracked products — not store-scoped (products aren't per-store), joined
// against `inventory` client-side to know what's been counted where.
export async function listStockTrackedProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_stock_tracked', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listInventoryForStore(storeId: string) {
  const { data, error } = await supabase.from('inventory').select('*').eq('store_id', storeId)
  if (error) throw error
  return data ?? []
}
