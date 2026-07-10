import { useAsync } from '@/shared/hooks/useAsync'
import {
  listAssignedAccounts,
  listUnassignedAccounts,
  listAllStoreAccountAssignments,
  listAllStaffProfiles,
} from '@/features/stores/api/storeAccounts'

export function useAssignedAccounts(storeId: string | null) {
  return useAsync(() => (storeId ? listAssignedAccounts(storeId) : Promise.resolve([])), [storeId])
}

export function useUnassignedAccounts() {
  return useAsync(() => listUnassignedAccounts(), [])
}

export function useAllStoreAccountAssignments() {
  return useAsync(() => listAllStoreAccountAssignments(), [])
}

export function useAllStaffProfiles() {
  return useAsync(() => listAllStaffProfiles(), [])
}
