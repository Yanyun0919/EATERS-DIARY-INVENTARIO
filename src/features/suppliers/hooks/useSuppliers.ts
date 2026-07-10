import { useAsync } from '@/shared/hooks/useAsync'
import { listSuppliers, type SupplierFilters } from '@/features/suppliers/api/suppliers'

export function useSuppliers(filters: SupplierFilters) {
  return useAsync(() => listSuppliers(filters), [filters.search, filters.isActive])
}
