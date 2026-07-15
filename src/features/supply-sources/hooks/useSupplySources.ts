import { useAsync } from '@/shared/hooks/useAsync'
import {
  listSupplySources,
  getSupplySourceLocaleConfig,
  listProductionCenterStores,
  type SupplySourceFilters,
} from '@/features/supply-sources/api/supplySources'

export function useSupplySources(filters: SupplySourceFilters) {
  return useAsync(() => listSupplySources(filters), [filters.search, filters.isActive])
}

export function useSupplySourceLocaleConfig(supplySourceId: string | null) {
  return useAsync(
    () => (supplySourceId ? getSupplySourceLocaleConfig(supplySourceId) : Promise.resolve(null)),
    [supplySourceId],
  )
}

export function useProductionCenterStores() {
  return useAsync(() => listProductionCenterStores(), [])
}
