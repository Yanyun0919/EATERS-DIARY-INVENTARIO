import { useAsync } from '@/features/products/hooks/useAsync'
import { listSupplierProducts, listUnitConversions, listAliases } from '@/features/products/api/productRelations'

export function useSupplierProducts(productId: string | null) {
  return useAsync(() => (productId ? listSupplierProducts(productId) : Promise.resolve([])), [productId])
}

export function useUnitConversions(productId: string | null) {
  return useAsync(() => (productId ? listUnitConversions(productId) : Promise.resolve([])), [productId])
}

export function useAliases(productId: string | null) {
  return useAsync(() => (productId ? listAliases(productId) : Promise.resolve([])), [productId])
}
