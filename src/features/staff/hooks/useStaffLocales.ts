import { useAsync } from '@/shared/hooks/useAsync'
import { listStaffLocales } from '@/features/stores/api/storeAccounts'

export function useStaffLocales(staffProfileId: string | null) {
  return useAsync(() => (staffProfileId ? listStaffLocales(staffProfileId) : Promise.resolve([])), [staffProfileId])
}
