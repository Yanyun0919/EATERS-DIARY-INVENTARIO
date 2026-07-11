import { useAsync } from '@/shared/hooks/useAsync'
import {
  listAssignedAccounts,
  listUnassignedAccounts,
  listAllStoreAccountAssignments,
  listAllStaffProfiles,
  getMyStore,
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

export function useMyStore(staffProfileId: string | null) {
  return useAsync(() => (staffProfileId ? getMyStore(staffProfileId) : Promise.resolve(null)), [staffProfileId])
}
