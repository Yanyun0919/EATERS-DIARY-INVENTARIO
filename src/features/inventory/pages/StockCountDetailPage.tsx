import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES } from '@/shared/constants/routes'
import { useStore } from '@/features/stores/hooks/useStores'
import { useStorePermissions } from '@/features/stores/hooks/useStorePermissions'
import { useAllStaffProfiles } from '@/features/stores/hooks/useStoreAccounts'
import {
  useStockCount,
  useStockCountItemsForCounting,
  useStockCountItemsForReview,
} from '@/features/inventory/hooks/useStockCounts'
import { useStockTrackedProducts, useInventoryForStore } from '@/features/inventory/hooks/useInventory'
import { useAllCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import { useProducts } from '@/features/products/hooks/useProducts'
import { completeStockCount, cancelStockCount } from '@/features/inventory/api/stockCounts'
import { StockCountingScreen } from '@/features/inventory/components/StockCountingScreen'
import { StockCountReview } from '@/features/inventory/components/StockCountReview'
import { StockCountedList } from '@/features/inventory/components/StockCountedList'
import { statusLabels, statusClasses, formatStockCountDate } from '@/features/inventory/utils/stockCountDisplay'

export function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdministrator, loading: profileLoading } = useStaffProfile()

  const {
    data: stockCount,
    loading: stockCountLoading,
    error: stockCountError,
    refetch: refetchStockCount,
  } = useStockCount(id ?? null)
  const { data: store } = useStore(stockCount?.store_id ?? null)
  const { data: storePermissions } = useStorePermissions(stockCount?.store_id ?? null)
  const { data: staffProfiles } = useAllStaffProfiles()

  const canManage = isAdministrator || (storePermissions ?? []).some((permission) => permission.permission_key === 'stock_count')
  const isInProgress = stockCount?.status === 'in_progress'
  const isCompleted = stockCount?.status === 'completed'
  const isCompletedReview = isCompleted && isAdministrator
  const isCompletedCountedOnly = isCompleted && !isAdministrator

  const { data: products } = useStockTrackedProducts()
  const { data: inventoryRows } = useInventoryForStore(isInProgress ? (stockCount?.store_id ?? null) : null)
  const { data: allCategories } = useAllCategories()
  const { data: units } = useUnits()
  // Counted Stock only -- used both for the live counting screen and for Store Staff's view of a
  // completed count. Reused deliberately: the query never selects expected_quantity/variance, so
  // Stock Anterior/Diferencia never reach a non-Administrator session at all.
  const { data: countingItems } = useStockCountItemsForCounting(isInProgress || isCompletedCountedOnly ? (id ?? null) : null)
  const { data: reviewItems } = useStockCountItemsForReview(isCompletedReview ? (id ?? null) : null)
  const { data: allProducts } = useProducts({})

  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (profileLoading || stockCountLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (stockCountError || !stockCount) {
    return <p className="text-sm text-red-600">Conteo no encontrado.</p>
  }

  const categoriesById = new Map((allCategories ?? []).map((category) => [category.id, category]))
  const unitsById = new Map((units ?? []).map((unit) => [unit.id, unit]))
  const inventoryByProductId = new Map((inventoryRows ?? []).map((row) => [row.product_id, row]))
  const countedQuantityByProductId = new Map((countingItems ?? []).map((item) => [item.product_id, item.counted_quantity]))
  const productsById = new Map((allProducts ?? []).map((product) => [product.id, product]))
  const staffById = new Map((staffProfiles ?? []).map((staff) => [staff.id, staff]))
  const countedByName = stockCount.counted_by ? staffById.get(stockCount.counted_by)?.full_name : undefined

  async function handleComplete() {
    if (!id || !products) return
    const uncounted = products.length - countedQuantityByProductId.size
    if (uncounted > 0) {
      const confirmed = window.confirm(
        `${uncounted} productos no han sido contados. Su stock no se actualizará. ¿Completar de todas formas?`,
      )
      if (!confirmed) return
    }

    setActionError(null)
    setCompleting(true)
    try {
      await completeStockCount(id)
      refetchStockCount()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar el conteo')
    } finally {
      setCompleting(false)
    }
  }

  async function handleCancel() {
    if (!id) return
    const confirmed = window.confirm('¿Cancelar este conteo? No se guardará nada en el inventario.')
    if (!confirmed) return

    setActionError(null)
    setCancelling(true)
    try {
      await cancelStockCount(id)
      refetchStockCount()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo cancelar el conteo')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.STOCK_COUNTS)} className="text-sm text-accent hover:underline">
          ← Volver a conteos de stock
        </button>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{store?.name ?? 'Conteo de Stock'}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[stockCount.status]}`}>
            {statusLabels[stockCount.status]}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {formatStockCountDate(stockCount.completed_at ?? stockCount.started_at)}
          {countedByName ? ` · ${countedByName}` : ''}
        </p>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {isInProgress &&
        (canManage ? (
          <StockCountingScreen
            stockCountId={stockCount.id}
            products={products ?? []}
            categoriesById={categoriesById}
            unitsById={unitsById}
            inventoryByProductId={inventoryByProductId}
            countedQuantityByProductId={countedQuantityByProductId}
            readOnly={false}
            onComplete={handleComplete}
            onCancel={handleCancel}
            completing={completing}
            cancelling={cancelling}
          />
        ) : (
          <p className="text-sm text-neutral-500">No tienes permiso para gestionar este conteo.</p>
        ))}

      {isCompletedReview && (
        <StockCountReview
          items={reviewItems ?? []}
          productsById={productsById}
          categoriesById={categoriesById}
          unitsById={unitsById}
        />
      )}

      {isCompletedCountedOnly && (
        <StockCountedList
          items={countingItems ?? []}
          productsById={productsById}
          categoriesById={categoriesById}
          unitsById={unitsById}
        />
      )}

      {stockCount.status === 'cancelled' && <p className="text-sm text-neutral-500">Este conteo fue cancelado.</p>}
    </div>
  )
}
