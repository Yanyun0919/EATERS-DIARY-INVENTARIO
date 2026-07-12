import { useAsync } from '@/shared/hooks/useAsync'
import { listStaff, getStaff, countActiveAdministrators, type StaffFilters } from '@/features/staff/api/staff'

export function useStaffList(filters: StaffFilters) {
  return useAsync(() => listStaff(filters), [filters.search, filters.role, filters.isActive])
}

export function useStaffMember(id: string | null) {
  return useAsync(() => (id ? getStaff(id) : Promise.resolve(null)), [id])
}

export function useActiveAdministratorCount() {
  return useAsync(() => countActiveAdministrators(), [])
}
