import { supabase } from '@/core/supabase/client'
import type { Database } from '@/core/supabase/database.types'

type StorePurchaseRequest = Database['public']['Tables']['store_purchase_requests']['Row']
type StorePurchaseRequestItem = Database['public']['Tables']['store_purchase_request_items']['Row']

export interface StorePurchaseRequestFilters {
  storeId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

// Resolves which store_purchase_requests match a search term across Notes and Product Name --
// two separate ilike queries merged and de-duplicated here, same pattern already approved for
// Purchasing's search (listPurchaseOrderIdsMatchingSearch).
async function listStorePurchaseRequestIdsMatchingSearch(term: string): Promise<string[]> {
  const [byNotes, byProductName] = await Promise.all([
    supabase.from('store_purchase_requests').select('id').ilike('notes', `%${term}%`),
    supabase.from('store_purchase_request_items').select('store_purchase_request_id').ilike('product_name', `%${term}%`),
  ])
  if (byNotes.error) throw byNotes.error
  if (byProductName.error) throw byProductName.error

  const ids = new Set<string>()
  for (const row of byNotes.data ?? []) ids.add(row.id)
  for (const row of byProductName.data ?? []) ids.add(row.store_purchase_request_id)
  return [...ids]
}

export async function listStorePurchaseRequests(filters: StorePurchaseRequestFilters = {}) {
  const term = filters.search?.trim()
  let matchingIds: string[] | null = null

  if (term) {
    matchingIds = await listStorePurchaseRequestIdsMatchingSearch(term)
    if (matchingIds.length === 0) return []
  }

  let query = supabase.from('store_purchase_requests').select('*').order('created_at', { ascending: false })

  if (filters.storeId) {
    query = query.eq('store_id', filters.storeId)
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo)
  }
  if (matchingIds) {
    query = query.in('id', matchingIds)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export interface StorePurchaseRequestDetail {
  request: StorePurchaseRequest
  items: StorePurchaseRequestItem[]
}

// Single read, no joins needed -- product_name is already a snapshot on the item rows
// (migration 026). Ordered by created_at ascending (insertion order), same convention already
// used for Purchase Order Detail; the UI applies the Category Order / Product Name display
// sort on top of this at render time (no persisted display_order -- approved Technical Design).
export async function getStorePurchaseRequestDetail(id: string): Promise<StorePurchaseRequestDetail | null> {
  const { data: request, error: requestError } = await supabase
    .from('store_purchase_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (requestError) throw requestError
  if (!request) return null

  const { data: items, error: itemsError } = await supabase
    .from('store_purchase_request_items')
    .select('*')
    .eq('store_purchase_request_id', id)
    .order('created_at', { ascending: true })
  if (itemsError) throw itemsError

  return { request, items: items ?? [] }
}

export interface NewStorePurchaseRequestItemInput {
  productId: string
  requestedQuantity: number
}

export interface NewStorePurchaseRequestInput {
  storeId: string
  notes: string | null
  items: NewStorePurchaseRequestItemInput[]
}

// submit_store_purchase_request() (migration 026) is the sole write path -- a single
// security-definer transaction, same design philosophy as create_purchase_order(). It resolves
// product_name itself from current data at the moment of the transaction, rather than trusting
// a client-supplied snapshot -- so only requested_quantity is sent per item, since that's the
// Store Manager's actual decision (freely editable in the Draft, per the approved design), not
// a value to independently re-derive. submitted_by is resolved server-side from the caller's
// own session.
export async function submitStorePurchaseRequest(input: NewStorePurchaseRequestInput): Promise<string> {
  const { data, error } = await supabase.rpc('submit_store_purchase_request', {
    target_store_id: input.storeId,
    target_notes: input.notes,
    target_items: input.items.map((item) => ({
      product_id: item.productId,
      requested_quantity: item.requestedQuantity,
    })),
  })
  if (error) throw error
  return data
}
