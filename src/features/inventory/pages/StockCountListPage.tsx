import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { stockCountDetailRoute } from '@/shared/constants/routes'
import { useStores } from '@/features/stores/hooks/useStores'
import { useAllStaffProfiles, useMyStore } from '@/features/stores/hooks/useStoreAccounts'
import { useStorePermissions } from '@/features/stores/hooks/useStorePermissions'
import { useStockCounts, useActiveStockCount } from '@/features/inventory/hooks/useStockCounts'
import { createStockCount } from '@/features/inventory/api/stockCounts'
import { StockCountFilters, type StatusFilter } from '@/features/inventory/components/StockCountFilters'
import { StockCountTable } from '@/features/inventory/components/StockCountTable'
import type { StockCountStatus } from '@/core/supabase/database.types'

const selectClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function StockCountListPage() {
  const navigate = useNavigate()
  const { profile, isAdministrator } = useStaffProfile()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { data: stores } = useStores({ isActive: true })
  const { data: staffProfiles } = useAllStaffProfiles()
  const { data: myStore } = useMyStore(profile?.id ?? null)

  // The store this account can act on right now — the same store the List's own filter is
  // scoped to for Administrator, or the account's single assigned store otherwise.
  const actionStoreId = isAdministrator ? selectedStoreId || null : (myStore?.id ?? null)

  const { data: storePermissions } = useStorePermissions(actionStoreId)
  const canManage = isAdministrator || (storePermissions ?? []).some((permission) => permission.permission_key === 'stock_count')
  const { data: activeStockCount, refetch: refetchActiveStockCount } = useActiveStockCount(actionStoreId)

  const {
    data: stockCounts,
    loading,
    error,
    refetch: refetchStockCounts,
  } = useStockCounts({
    storeId: isAdministrator ? selectedStoreId || undefined : undefined,
    status: statusFilter === 'all' ? undefined : (statusFilter as StockCountStatus),
  })

  const storesById = useMemo(() => new Map((stores ?? []).map((store) => [store.id, store])), [stores])
  const staffById = useMemo(() => new Map((staffProfiles ?? []).map((staff) => [staff.id, staff])), [staffProfiles])

  async function handleStartCount() {
    if (!actionStoreId) return
    setStartError(null)
    setStarting(true)
    try {
      const created = await createStockCount(actionStoreId)
      navigate(stockCountDetailRoute(created.id))
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'No se pudo iniciar el conteo')
      refetchActiveStockCount()
      refetchStockCounts()
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Conteos de Stock</h1>

      {actionStoreId && canManage && (
        <div className="flex items-center gap-2 rounded-md border border-border p-3">
          {activeStockCount ? (
            <Button onClick={() => navigate(stockCountDetailRoute(activeStockCount.id))}>Continuar Conteo</Button>
          ) : (
            <Button onClick={handleStartCount} disabled={starting}>
              {starting ? 'Iniciando…' : 'Iniciar Conteo'}
            </Button>
          )}
          {startError && <p className="text-sm text-red-600">{startError}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isAdministrator && (
          <select
            value={selectedStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            className={selectClasses}
          >
            <option value="">Todas las tiendas</option>
            {(stores ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        )}
        <StockCountFilters statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
      </div>

      {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <StockCountTable stockCounts={stockCounts ?? []} storesById={storesById} staffById={staffById} />
      )}
    </div>
  )
}
