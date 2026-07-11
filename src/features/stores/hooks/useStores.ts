import { useAsync } from '@/shared/hooks/useAsync'
import { listStores, listBrands, getStore, type StoreFilters } from '@/features/stores/api/stores'

export function useStores(filters: StoreFilters) {
  return useAsync(() => listStores(filters), [filters.search, filters.isActive])
}

export function useBrands() {
  return useAsync(() => listBrands(), [])
}

export function useStore(id: string | null) {
  return useAsync(() => (id ? getStore(id) : Promise.resolve(null)), [id])
}
