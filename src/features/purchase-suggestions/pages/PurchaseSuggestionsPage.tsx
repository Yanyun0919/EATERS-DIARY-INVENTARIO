import { useMemo, useState } from 'react'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { useStores } from '@/features/stores/hooks/useStores'
import { useStockTrackedProducts, useInventoryForStore } from '@/features/inventory/hooks/useInventory'
import { useAllCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import {
  PurchaseSuggestionsTable,
  type SuggestionRow,
} from '@/features/purchase-suggestions/components/PurchaseSuggestionsTable'

const selectClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// Purchase Suggestions has no persistent storage of its own (approved business design,
// 2026-07-11): everything below is a live recomputation from Inventory + Product Minimum Stock,
// and quantityOverrides is local UI state only -- a refresh discards it and regenerates fresh.
export function PurchaseSuggestionsPage() {
  const { profile, isAdministrator, loading: profileLoading } = useStaffProfile()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [quantityOverrides, setQuantityOverrides] = useState<Map<string, string>>(new Map())

  const isPurchasing = profile?.role === 'purchasing'
  const canView = isAdministrator || isPurchasing

  const { data: stores } = useStores({ isActive: true })
  const { data: products, loading: productsLoading } = useStockTrackedProducts()
  const { data: inventoryRows, loading: inventoryLoading } = useInventoryForStore(selectedStoreId || null)
  const { data: allCategories } = useAllCategories()
  const { data: units } = useUnits()

  const categoriesById = useMemo(
    () => new Map((allCategories ?? []).map((category) => [category.id, category])),
    [allCategories],
  )
  const unitsById = useMemo(() => new Map((units ?? []).map((unit) => [unit.id, unit])), [units])
  const inventoryByProductId = useMemo(
    () => new Map((inventoryRows ?? []).map((row) => [row.product_id, row])),
    [inventoryRows],
  )

  const { rows, notCountedCount, lowStockCount } = useMemo(() => {
    const suggestionRows: SuggestionRow[] = []

    for (const product of products ?? []) {
      const inventory = inventoryByProductId.get(product.id)
      if (!inventory) {
        suggestionRows.push({ product, status: 'not_counted', currentStock: null, suggestedQuantity: null })
        continue
      }
      const currentStock = Number(inventory.quantity_on_hand)
      const minimumStock = Number(product.minimum_stock)
      if (currentStock < minimumStock) {
        suggestionRows.push({
          product,
          status: 'low_stock',
          currentStock,
          suggestedQuantity: minimumStock - currentStock,
        })
      }
    }

    // Sin Contar first (needs a count before any purchasing decision), then Stock Bajo, then
    // Category Order, then Product Name.
    const statusPriority = { not_counted: 0, low_stock: 1 } as const
    suggestionRows.sort((a, b) => {
      if (a.status !== b.status) return statusPriority[a.status] - statusPriority[b.status]
      const categoryOrderA = categoriesById.get(a.product.category_id)?.sort_order ?? 0
      const categoryOrderB = categoriesById.get(b.product.category_id)?.sort_order ?? 0
      if (categoryOrderA !== categoryOrderB) return categoryOrderA - categoryOrderB
      return a.product.name.localeCompare(b.product.name)
    })

    return {
      rows: suggestionRows,
      notCountedCount: suggestionRows.filter((row) => row.status === 'not_counted').length,
      lowStockCount: suggestionRows.filter((row) => row.status === 'low_stock').length,
    }
  }, [products, inventoryByProductId, categoriesById])

  function handleQuantityChange(productId: string, value: string) {
    setQuantityOverrides((prev) => new Map(prev).set(productId, value))
  }

  if (profileLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (!canView) {
    return <p className="text-sm text-red-600">No tienes permiso para ver esta página.</p>
  }

  const loading = productsLoading || inventoryLoading

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Sugerencias de Compra</h1>

      <div className="flex items-center gap-2">
        <label htmlFor="store" className="text-sm font-medium">
          Tienda
        </label>
        <select
          id="store"
          value={selectedStoreId}
          onChange={(event) => setSelectedStoreId(event.target.value)}
          className={selectClasses}
        >
          <option value="">Selecciona una tienda</option>
          {(stores ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedStoreId && (
        <p className="text-sm text-neutral-500">Selecciona una tienda para ver las sugerencias de compra.</p>
      )}

      {selectedStoreId && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Productos con Stock Bajo: <strong>{lowStockCount}</strong>
            </span>
            <span>
              Productos Sin Contar: <strong>{notCountedCount}</strong>
            </span>
          </div>

          {loading && <p className="text-sm text-neutral-500">Cargando…</p>}

          {!loading && (
            <PurchaseSuggestionsTable
              rows={rows}
              categoriesById={categoriesById}
              unitsById={unitsById}
              quantityOverrides={quantityOverrides}
              onQuantityChange={handleQuantityChange}
            />
          )}
        </>
      )}
    </div>
  )
}
