import { useAsync } from '@/shared/hooks/useAsync'
import { listStaffPermissionDefinitions, listStaffPermissions } from '@/features/staff/api/staffPermissions'

export function useStaffPermissionDefinitions() {
  return useAsync(() => listStaffPermissionDefinitions(), [])
}

export function useStaffPermissionsFor(staffProfileId: string | null) {
  return useAsync(() => (staffProfileId ? listStaffPermissions(staffProfileId) : Promise.resolve([])), [staffProfileId])
}
