import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useStores } from '@/features/stores/hooks/useStores'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { usePurchaseOrdersWithTotals } from '@/features/purchasing/hooks/usePurchaseOrders'
import { PurchasingFilters } from '@/features/purchasing/components/PurchasingFilters'
import { PurchaseOrdersTable } from '@/features/purchasing/components/PurchaseOrdersTable'

// Read-only history list (Page 1 of 3). No row click yet -- Purchase Detail is Page 3, not
// built.
export function ComprasPage() {
  const { profile, isAdministrator, loading: profileLoading } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const debouncedSearch = useDebouncedValue(search)

  const isPurchasing = profile?.role === 'purchasing'
  const canView = isAdministrator || isPurchasing

  const { data: stores } = useStores({ isActive: true })
  const { data: suppliers } = useSuppliers({ isActive: true })
  const {
    data: purchaseOrders,
    loading,
    error,
  } = usePurchaseOrdersWithTotals({
    storeId: storeId || undefined,
    supplierId: supplierId || undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const storesById = useMemo(() => new Map((stores ?? []).map((store) => [store.id, store])), [stores])

  const summary = useMemo(() => {
    const orders = purchaseOrders ?? []
    return {
      count: orders.length,
      total: orders.reduce((sum, order) => sum + order.total, 0),
    }
  }, [purchaseOrders])

  if (profileLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (!canView) {
    return <p className="text-sm text-red-600">No tienes permiso para ver esta página.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Compras</h1>
        <Link to={ROUTES.PURCHASE_NEW}>
          <Button>Nueva Compra</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          Compras: <strong>{summary.count}</strong>
        </span>
        <span>
          Importe Total: <strong>{summary.total.toFixed(2)} €</strong>
        </span>
      </div>

      <PurchasingFilters
        search={search}
        onSearchChange={setSearch}
        storeId={storeId}
        onStoreChange={setStoreId}
        stores={stores ?? []}
        supplierId={supplierId}
        onSupplierChange={setSupplierId}
        suppliers={suppliers ?? []}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && <PurchaseOrdersTable purchaseOrders={purchaseOrders ?? []} storesById={storesById} />}
    </div>
  )
}
