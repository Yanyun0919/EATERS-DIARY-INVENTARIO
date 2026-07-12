import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useStores } from '@/features/stores/hooks/useStores'
import { useAllStoreAccountAssignments } from '@/features/stores/hooks/useStoreAccounts'
import { useStaffList } from '@/features/staff/hooks/useStaff'
import { setStaffActive, countActiveAdministrators } from '@/features/staff/api/staff'
import { StaffFilters, type ActiveFilter, type RoleFilter } from '@/features/staff/components/StaffFilters'
import { StaffTable } from '@/features/staff/components/StaffTable'
import type { Database } from '@/core/supabase/database.types'

type StaffProfile = Database['public']['Tables']['staff_profiles']['Row']

export function StaffListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)

  const {
    data: staff,
    loading,
    error,
    refetch,
  } = useStaffList({
    search: debouncedSearch,
    role: roleFilter === 'all' ? undefined : roleFilter,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  const { data: assignments } = useAllStoreAccountAssignments()
  const { data: stores } = useStores({ isActive: true })

  const storeNameById = new Map((stores ?? []).map((store) => [store.id, store.name]))
  const localeNamesByStaff = new Map<string, string[]>()
  for (const assignment of assignments ?? []) {
    const name = storeNameById.get(assignment.store_id)
    if (!name) continue
    const list = localeNamesByStaff.get(assignment.staff_profile_id) ?? []
    list.push(name)
    localeNamesByStaff.set(assignment.staff_profile_id, list)
  }

  async function handleToggleActive(member: StaffProfile) {
    setToggleError(null)

    if (member.is_active && member.role === 'administrator') {
      const activeAdmins = await countActiveAdministrators()
      if (activeAdmins <= 1) {
        setToggleError('No se puede desactivar: es el último Administrador activo.')
        return
      }
    }

    setTogglingId(member.id)
    try {
      await setStaffActive(member.id, !member.is_active)
      refetch()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Personal</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.STAFF_NEW}>
            <Button>Nuevo Empleado</Button>
          </Link>
        )}
      </div>

      <StaffFilters
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {toggleError && <p className="text-sm text-red-600">{toggleError}</p>}

      {!loading && !error && (
        <StaffTable
          staff={staff ?? []}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
          localeNamesByStaff={localeNamesByStaff}
        />
      )}
    </div>
  )
}
