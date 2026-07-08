import { useAsync } from '@/features/products/hooks/useAsync'
import { listCategories, listUnits } from '@/features/products/api/products'
import { listSuppliers } from '@/features/products/api/productRelations'

export function useCategories() {
  return useAsync(() => listCategories(), [])
}

export function useUnits() {
  return useAsync(() => listUnits(), [])
}

export function useSuppliers() {
  return useAsync(() => listSuppliers(), [])
}
