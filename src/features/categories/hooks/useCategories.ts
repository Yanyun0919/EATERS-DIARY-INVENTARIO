import { useAsync } from '@/shared/hooks/useAsync'
import { listCategories, type CategoryFilters } from '@/features/categories/api/categories'

export function useCategories(filters: CategoryFilters) {
  return useAsync(() => listCategories(filters), [filters.search, filters.isActive])
}
