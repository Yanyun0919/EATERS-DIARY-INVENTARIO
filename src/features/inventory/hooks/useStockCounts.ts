import { useAsync } from '@/shared/hooks/useAsync'
import {
  listStockCounts,
  getStockCount,
  getActiveStockCount,
  listStockCountItemsForCounting,
  listStockCountItemsForReview,
  type StockCountFilters,
} from '@/features/inventory/api/stockCounts'

export function useStockCounts(filters: StockCountFilters) {
  return useAsync(() => listStockCounts(filters), [filters.storeId, filters.status])
}

export function useStockCount(id: string | null) {
  return useAsync(() => (id ? getStockCount(id) : Promise.resolve(null)), [id])
}

export function useActiveStockCount(storeId: string | null) {
  return useAsync(() => (storeId ? getActiveStockCount(storeId) : Promise.resolve(null)), [storeId])
}

export function useStockCountItemsForCounting(stockCountId: string | null) {
  return useAsync(() => (stockCountId ? listStockCountItemsForCounting(stockCountId) : Promise.resolve([])), [stockCountId])
}

export function useStockCountItemsForReview(stockCountId: string | null) {
  return useAsync(() => (stockCountId ? listStockCountItemsForReview(stockCountId) : Promise.resolve([])), [stockCountId])
}
