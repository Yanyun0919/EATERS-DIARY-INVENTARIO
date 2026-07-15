import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { useStores } from '@/features/stores/hooks/useStores'
import { useStockTrackedProducts, useInventoryForStore } from '@/features/inventory/hooks/useInventory'
import { useAllCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import { submitStorePurchaseRequest } from '@/features/store-purchase-requests/api/storePurchaseRequests'
import {
  StorePurchaseRequestDraftTable,
  type DraftRow,
} from '@/features/store-purchase-requests/components/StorePurchaseRequestDraftTable'
import { AddDraftProduct } from '@/features/store-purchase-requests/components/AddDraftProduct'
import { categoryOrderThenName } from '@/features/store-purchase-requests/utils/storePurchaseRequestDisplay'
import { storePurchaseRequestDetailRoute } from '@/shared/constants/routes'

const selectClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'
const textareaClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// Draft (Stock Count -> Draft -> Manager Review -> Submit -> Store Purchase Request). Reuses
// the exact computation Purchase Suggestions already provided (Current Stock vs Minimum
// Stock) -- no new Draft API, per the approved Technical Design. Nothing here is persisted
// until Submit; a refresh discards every override, removal, and manual addition and
// regenerates fresh from Inventory, same as Purchase Suggestions always worked.
export function StorePurchaseRequestNewPage() {
  const navigate = useNavigate()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [quantityOverrides, setQuantityOverrides] = useState<Map<string, string>>(new Map())
  const [removedProductIds, setRemovedProductIds] = useState<Set<string>>(new Set())
  const [manualProductIds, setManualProductIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const productsById = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products])
  const inventoryByProductId = useMemo(
    () => new Map((inventoryRows ?? []).map((row) => [row.product_id, row])),
    [inventoryRows],
  )

  const { suggestedRows, notCountedCount, lowStockCount } = useMemo(() => {
    const rows: DraftRow[] = []

    for (const product of products ?? []) {
      const inventory = inventoryByProductId.get(product.id)
      if (!inventory) {
        rows.push({ product, status: 'not_counted', currentStock: null, suggestedQuantity: null })
        continue
      }
      const currentStock = Number(inventory.quantity_on_hand)
      const minimumStock = Number(product.minimum_stock)
      if (currentStock < minimumStock) {
        rows.push({
          product,
          status: 'low_stock',
          currentStock,
          suggestedQuantity: minimumStock - currentStock,
        })
      }
    }

    // Sin Contar first (needs a count before any purchasing decision), then Stock Bajo, then
    // Category Order, then Product Name -- unchanged from Purchase Suggestions' existing,
    // already-approved priority.
    const statusPriority = { not_counted: 0, low_stock: 1, manual: 2 } as const
    rows.sort((a, b) => {
      if (a.status !== b.status) return statusPriority[a.status] - statusPriority[b.status]
      return categoryOrderThenName(categoriesById, a.product.category_id, a.product.name, b.product.category_id, b.product.name)
    })

    return {
      suggestedRows: rows,
      notCountedCount: rows.filter((row) => row.status === 'not_counted').length,
      lowStockCount: rows.filter((row) => row.status === 'low_stock').length,
    }
  }, [products, inventoryByProductId, categoriesById])

  const manualRows = useMemo(() => {
    const rows: DraftRow[] = manualProductIds
      .map((productId) => productsById.get(productId))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map((product) => {
        const inventory = inventoryByProductId.get(product.id)
        return {
          product,
          status: 'manual' as const,
          currentStock: inventory ? Number(inventory.quantity_on_hand) : null,
          suggestedQuantity: null,
        }
      })
    // Consistent with the project's standard product ordering (Category Order, then Product
    // Name) -- no persisted display_order, computed live same as everywhere else.
    rows.sort((a, b) =>
      categoryOrderThenName(categoriesById, a.product.category_id, a.product.name, b.product.category_id, b.product.name),
    )
    return rows
  }, [manualProductIds, productsById, inventoryByProductId, categoriesById])

  const rows = useMemo(() => [...suggestedRows, ...manualRows], [suggestedRows, manualRows])

  // Excludes anything already shown (suggested or manually added) -- a product never appears
  // twice, and requesting an uncounted product happens through this picker instead of a
  // duplicate quantity field on its Sin Contar row.
  const availableForManualAdd = useMemo(() => {
    const shownProductIds = new Set(rows.map((row) => row.product.id))
    return (products ?? [])
      .filter((product) => !shownProductIds.has(product.id))
      .sort((a, b) => categoryOrderThenName(categoriesById, a.category_id, a.name, b.category_id, b.name))
  }, [products, rows, categoriesById])

  function handleQuantityChange(productId: string, value: string) {
    setQuantityOverrides((prev) => new Map(prev).set(productId, value))
  }

  function handleToggleRemoved(productId: string) {
    setRemovedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function handleAddManualProduct(productId: string) {
    setManualProductIds((prev) => [...prev, productId])
  }

  function handleRemoveManualRow(productId: string) {
    setManualProductIds((prev) => prev.filter((id) => id !== productId))
    setQuantityOverrides((prev) => {
      const next = new Map(prev)
      next.delete(productId)
      return next
    })
  }

  async function handleSubmit() {
    if (!selectedStoreId) {
      setError('Selecciona una tienda')
      return
    }

    const items = rows
      .filter((row) => row.status !== 'not_counted')
      .filter((row) => !(row.status === 'low_stock' && removedProductIds.has(row.product.id)))
      .map((row) => {
        const raw = quantityOverrides.get(row.product.id) ?? (row.suggestedQuantity !== null ? String(row.suggestedQuantity) : '')
        return { productId: row.product.id, requestedQuantity: Number(raw) }
      })
      .filter((item) => Number.isFinite(item.requestedQuantity) && item.requestedQuantity > 0)

    if (items.length === 0) {
      setError('Añade al menos un producto con una cantidad mayor que cero')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const id = await submitStorePurchaseRequest({ storeId: selectedStoreId, notes: notes.trim() || null, items })
      navigate(storePurchaseRequestDetailRoute(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const loading = productsLoading || inventoryLoading

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Nueva Solicitud de Compra</h1>

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
        <p className="text-sm text-neutral-500">Selecciona una tienda para revisar la solicitud de compra.</p>
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
            <>
              <StorePurchaseRequestDraftTable
                rows={rows}
                categoriesById={categoriesById}
                unitsById={unitsById}
                quantityOverrides={quantityOverrides}
                onQuantityChange={handleQuantityChange}
                removedProductIds={removedProductIds}
                onToggleRemoved={handleToggleRemoved}
                onRemoveManualRow={handleRemoveManualRow}
              />

              <AddDraftProduct availableProducts={availableForManualAdd} onAdd={handleAddManualProduct} />

              <div className="space-y-1">
                <label htmlFor="notes" className="text-sm font-medium">
                  Notas (opcional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className={textareaClasses}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar Solicitud'}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
