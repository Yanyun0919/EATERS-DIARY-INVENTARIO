import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useSupplySources } from '@/features/supply-sources/hooks/useSupplySources'
import { setSupplySourceActive } from '@/features/supply-sources/api/supplySources'
import { SupplySourceFilters, type ActiveFilter } from '@/features/supply-sources/components/SupplySourceFilters'
import { SupplySourceTable } from '@/features/supply-sources/components/SupplySourceTable'
import type { Database } from '@/core/supabase/database.types'

type SupplySource = Database['public']['Tables']['supply_sources']['Row']

export function SupplySourceListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)

  const {
    data: supplySources,
    loading,
    error,
    refetch,
  } = useSupplySources({
    search: debouncedSearch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  async function handleToggleActive(supplySource: SupplySource) {
    setTogglingId(supplySource.id)
    try {
      await setSupplySourceActive(supplySource.id, !supplySource.is_active)
      refetch()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Supply Sources</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.SUPPLY_SOURCE_NEW}>
            <Button>Add Supply Source</Button>
          </Link>
        )}
      </div>

      <SupplySourceFilters
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <SupplySourceTable
          supplySources={supplySources ?? []}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
        />
      )}
    </div>
  )
}
