import { useAsync } from '@/shared/hooks/useAsync'
import { listProducts, type ProductFilters } from '@/features/products/api/products'

export function useProducts(filters: ProductFilters) {
  return useAsync(() => listProducts(filters), [filters.search, filters.categoryId, filters.isActive])
}
