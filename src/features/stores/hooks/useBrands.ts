import { useAsync } from '@/shared/hooks/useAsync'
import { listBrands } from '@/features/stores/api/brands'

export function useBrands(isActive?: boolean) {
  return useAsync(() => listBrands(isActive), [isActive])
}
