import { useAsync } from '@/shared/hooks/useAsync'
import {
  listPermissionDefinitions,
  listStorePermissions,
  listAllStorePermissionGrants,
} from '@/features/stores/api/storePermissions'

export function usePermissionDefinitions() {
  return useAsync(() => listPermissionDefinitions(), [])
}

export function useStorePermissions(storeId: string | null) {
  return useAsync(() => (storeId ? listStorePermissions(storeId) : Promise.resolve([])), [storeId])
}

export function useAllStorePermissionGrants() {
  return useAsync(() => listAllStorePermissionGrants(), [])
}
