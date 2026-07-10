import { useAsync } from '@/shared/hooks/useAsync'
import { listProductsSuppliedBy, listProductsForPicker } from '@/features/suppliers/api/productSuppliers'

export function useProductsSuppliedBy(supplierId: string | null) {
  return useAsync(() => (supplierId ? listProductsSuppliedBy(supplierId) : Promise.resolve([])), [supplierId])
}

export function useProductsForPicker() {
  return useAsync(() => listProductsForPicker(), [])
}
