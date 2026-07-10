import { useAsync } from '@/shared/hooks/useAsync'
import { listCategories, listAllCategories, listUnits } from '@/features/products/api/products'

export function useCategories() {
  return useAsync(() => listCategories(), [])
}

export function useAllCategories() {
  return useAsync(() => listAllCategories(), [])
}

export function useUnits() {
  return useAsync(() => listUnits(), [])
}
