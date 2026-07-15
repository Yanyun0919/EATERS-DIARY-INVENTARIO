import { useAsync } from '@/shared/hooks/useAsync'
import {
  listPurchaseOrdersWithTotals,
  getPurchaseOrderDetail,
  type PurchaseOrderFilters,
} from '@/features/purchasing/api/purchaseOrders'

export function usePurchaseOrdersWithTotals(filters: PurchaseOrderFilters) {
  return useAsync(
    () => listPurchaseOrdersWithTotals(filters),
    [filters.storeId, filters.supplierId, filters.search, filters.dateFrom, filters.dateTo],
  )
}

export function usePurchaseOrderDetail(id: string | null) {
  return useAsync(() => (id ? getPurchaseOrderDetail(id) : Promise.resolve(null)), [id])
}
