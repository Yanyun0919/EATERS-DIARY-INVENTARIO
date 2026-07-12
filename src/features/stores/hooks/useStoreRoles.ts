import { useAsync } from '@/shared/hooks/useAsync'
import { listStoreRoleDefinitions, listStoreRoles, listAllStoreRoles } from '@/features/stores/api/storeRoles'

export function useStoreRoleDefinitions() {
  return useAsync(() => listStoreRoleDefinitions(), [])
}

export function useStoreRoles(storeId: string | null) {
  return useAsync(() => (storeId ? listStoreRoles(storeId) : Promise.resolve([])), [storeId])
}

export function useAllStoreRoles() {
  return useAsync(() => listAllStoreRoles(), [])
}
