import { useAsync } from '@/shared/hooks/useAsync'
import { listStockTrackedProducts, listInventoryForStore } from '@/features/inventory/api/inventory'

export function useStockTrackedProducts() {
  return useAsync(() => listStockTrackedProducts(), [])
}

export function useInventoryForStore(storeId: string | null) {
  return useAsync(() => (storeId ? listInventoryForStore(storeId) : Promise.resolve([])), [storeId])
}
