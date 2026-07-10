import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { setSupplierActive } from '@/features/suppliers/api/suppliers'
import { SupplierFilters, type ActiveFilter } from '@/features/suppliers/components/SupplierFilters'
import { SupplierTable } from '@/features/suppliers/components/SupplierTable'
import type { Database } from '@/core/supabase/database.types'

type Supplier = Database['public']['Tables']['suppliers']['Row']

export function SupplierListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)

  const {
    data: suppliers,
    loading,
    error,
    refetch,
  } = useSuppliers({
    search: debouncedSearch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  async function handleToggleActive(supplier: Supplier) {
    setTogglingId(supplier.id)
    try {
      await setSupplierActive(supplier.id, !supplier.is_active)
      refetch()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Suppliers</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.SUPPLIER_NEW}>
            <Button>Add Supplier</Button>
          </Link>
        )}
      </div>

      <SupplierFilters
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <SupplierTable
          suppliers={suppliers ?? []}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
        />
      )}
    </div>
  )
}
