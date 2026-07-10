import { useAsync } from '@/shared/hooks/useAsync'
import { listCategories, listUnits } from '@/features/products/api/products'

export function useCategories() {
  return useAsync(() => listCategories(), [])
}

export function useUnits() {
  return useAsync(() => listUnits(), [])
}
