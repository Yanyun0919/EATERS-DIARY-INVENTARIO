import { useAsync } from '@/shared/hooks/useAsync'
import {
  listStorePurchaseRequests,
  getStorePurchaseRequestDetail,
  type StorePurchaseRequestFilters,
} from '@/features/store-purchase-requests/api/storePurchaseRequests'

export function useStorePurchaseRequests(filters: StorePurchaseRequestFilters) {
  return useAsync(
    () => listStorePurchaseRequests(filters),
    [filters.storeId, filters.search, filters.dateFrom, filters.dateTo],
  )
}

export function useStorePurchaseRequestDetail(id: string | null) {
  return useAsync(() => (id ? getStorePurchaseRequestDetail(id) : Promise.resolve(null)), [id])
}
