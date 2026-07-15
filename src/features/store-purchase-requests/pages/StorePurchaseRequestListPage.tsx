import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useStores } from '@/features/stores/hooks/useStores'
import { useStorePurchaseRequests } from '@/features/store-purchase-requests/hooks/useStorePurchaseRequests'
import { StorePurchaseRequestFilters } from '@/features/store-purchase-requests/components/StorePurchaseRequestFilters'
import { StorePurchaseRequestsTable } from '@/features/store-purchase-requests/components/StorePurchaseRequestsTable'

// Read-only history list (Page 1). Row detail is Page 3 (StorePurchaseRequestDetailPage).
// No client-side role gate -- unlike Purchasing (role-based only), read access here is
// store-scoped (Administrator, Purchasing role, or any staff assigned to the store the row
// belongs to -- migration 026's SELECT policy). RLS is the real enforcement; this page simply
// renders whatever it returns, same pattern already used by ProductListPage.
export function StorePurchaseRequestListPage() {
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const debouncedSearch = useDebouncedValue(search)

  const { data: stores } = useStores({ isActive: true })
  const {
    data: requests,
    loading,
    error,
  } = useStorePurchaseRequests({
    storeId: storeId || undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const storesById = useMemo(() => new Map((stores ?? []).map((store) => [store.id, store])), [stores])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Solicitudes de Compra</h1>
        <Link to={ROUTES.STORE_PURCHASE_REQUEST_NEW}>
          <Button>Nueva Solicitud</Button>
        </Link>
      </div>

      <StorePurchaseRequestFilters
        search={search}
        onSearchChange={setSearch}
        storeId={storeId}
        onStoreChange={setStoreId}
        stores={stores ?? []}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && <StorePurchaseRequestsTable requests={requests ?? []} storesById={storesById} />}
    </div>
  )
}
