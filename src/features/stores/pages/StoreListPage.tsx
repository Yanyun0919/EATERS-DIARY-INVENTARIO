import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useStores } from '@/features/stores/hooks/useStores'
import { useAllStoreAccountAssignments, useAllStaffProfiles } from '@/features/stores/hooks/useStoreAccounts'
import { useAllStorePermissionGrants, usePermissionDefinitions } from '@/features/stores/hooks/useStorePermissions'
import { useAllStoreRoles, useStoreRoleDefinitions } from '@/features/stores/hooks/useStoreRoles'
import { setStoreActive } from '@/features/stores/api/stores'
import { StoreFilters, type ActiveFilter } from '@/features/stores/components/StoreFilters'
import { StoreTable } from '@/features/stores/components/StoreTable'
import type { Database } from '@/core/supabase/database.types'

type Store = Database['public']['Tables']['stores']['Row']

export function StoreListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)

  const {
    data: stores,
    loading,
    error,
    refetch,
  } = useStores({
    search: debouncedSearch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  const { data: assignments } = useAllStoreAccountAssignments()
  const { data: profiles } = useAllStaffProfiles()
  const { data: grants } = useAllStorePermissionGrants()
  const { data: definitions } = usePermissionDefinitions()
  const { data: allRoles } = useAllStoreRoles()
  const { data: roleDefinitions } = useStoreRoleDefinitions()

  const profileNameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const accountNamesByStore = new Map<string, string[]>()
  for (const assignment of assignments ?? []) {
    const name = profileNameById.get(assignment.staff_profile_id)
    if (!name) continue
    const list = accountNamesByStore.get(assignment.store_id) ?? []
    list.push(name)
    accountNamesByStore.set(assignment.store_id, list)
  }

  const definitionNameByKey = new Map((definitions ?? []).map((definition) => [definition.key, definition.name]))
  const capabilityNamesByStore = new Map<string, string[]>()
  for (const grant of grants ?? []) {
    const name = definitionNameByKey.get(grant.permission_key)
    if (!name) continue
    const list = capabilityNamesByStore.get(grant.store_id) ?? []
    list.push(name)
    capabilityNamesByStore.set(grant.store_id, list)
  }

  // Built by iterating role definitions (already sorted by sort_order) rather than the raw
  // store_roles rows, so each store's role list always renders in sort_order.
  const roleKeysByStore = new Map<string, Set<string>>()
  for (const role of allRoles ?? []) {
    const set = roleKeysByStore.get(role.store_id) ?? new Set<string>()
    set.add(role.role_key)
    roleKeysByStore.set(role.store_id, set)
  }
  const roleNamesByStore = new Map<string, string[]>()
  for (const [storeId, roleKeys] of roleKeysByStore) {
    const names = (roleDefinitions ?? []).filter((definition) => roleKeys.has(definition.key)).map((definition) => definition.name)
    roleNamesByStore.set(storeId, names)
  }

  async function handleToggleActive(store: Store) {
    setTogglingId(store.id)
    try {
      await setStoreActive(store.id, !store.is_active)
      refetch()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Locales</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.STORE_NEW}>
            <Button>Nuevo Local</Button>
          </Link>
        )}
      </div>

      <StoreFilters
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <StoreTable
          stores={stores ?? []}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
          accountNamesByStore={accountNamesByStore}
          capabilityNamesByStore={capabilityNamesByStore}
          roleNamesByStore={roleNamesByStore}
        />
      )}
    </div>
  )
}
