import { useMemo, useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import { StockCountItemRow } from '@/features/inventory/components/StockCountItemRow'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']
type Inventory = Database['public']['Tables']['inventory']['Row']

interface StockCountingScreenProps {
  stockCountId: string
  products: Product[]
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
  inventoryByProductId: Map<string, Inventory>
  countedQuantityByProductId: Map<string, string>
  readOnly: boolean
  onComplete: () => void
  onCancel: () => void
  completing: boolean
  cancelling: boolean
}

function isLowStock(product: Product, inventoryByProductId: Map<string, Inventory>) {
  const inventory = inventoryByProductId.get(product.id)
  return inventory !== undefined && Number(inventory.quantity_on_hand) < Number(product.minimum_stock)
}

export function StockCountingScreen({
  stockCountId,
  products,
  categoriesById,
  unitsById,
  inventoryByProductId,
  countedQuantityByProductId,
  readOnly,
  onComplete,
  onCancel,
  completing,
  cancelling,
}: StockCountingScreenProps) {
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => new Set(countedQuantityByProductId.keys()))

  const handleSaved = (productId: string) => {
    setSavedProductIds((prev) => new Set(prev).add(productId))
  }

  const { lowStockProducts, productsByCategory, categoriesInOrder } = useMemo(() => {
    const lowStock: Product[] = []
    const regular: Product[] = []

    for (const product of products) {
      if (isLowStock(product, inventoryByProductId)) {
        lowStock.push(product)
      } else {
        regular.push(product)
      }
    }

    const byName = (a: Product, b: Product) => a.name.localeCompare(b.name)
    lowStock.sort(byName)

    const byCategory = new Map<string, Product[]>()
    for (const product of regular) {
      const list = byCategory.get(product.category_id) ?? []
      list.push(product)
      byCategory.set(product.category_id, list)
    }
    for (const list of byCategory.values()) list.sort(byName)

    const orderedCategoryIds = [...byCategory.keys()].sort((a, b) => {
      const aOrder = categoriesById.get(a)?.sort_order ?? 0
      const bOrder = categoriesById.get(b)?.sort_order ?? 0
      return aOrder - bOrder
    })

    return { lowStockProducts: lowStock, productsByCategory: byCategory, categoriesInOrder: orderedCategoryIds }
  }, [products, inventoryByProductId, categoriesById])

  return (
    <div className="space-y-4 pb-20">
      <p className="text-sm text-neutral-500">
        {savedProductIds.size} de {products.length} productos contados
      </p>

      {lowStockProducts.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-amber-800">Stock Bajo</h2>
          <div className="rounded-md border border-border">
            {lowStockProducts.map((product) => (
              <StockCountItemRow
                key={product.id}
                stockCountId={stockCountId}
                product={product}
                unit={unitsById.get(product.base_unit_id)}
                initialValue={countedQuantityByProductId.get(product.id) ?? null}
                readOnly={readOnly}
                onSaved={handleSaved}
              />
            ))}
          </div>
        </div>
      )}

      {categoriesInOrder.map((categoryId) => (
        <div key={categoryId}>
          <h2 className="mb-1 text-sm font-semibold text-neutral-700">{categoriesById.get(categoryId)?.name ?? '—'}</h2>
          <div className="rounded-md border border-border">
            {(productsByCategory.get(categoryId) ?? []).map((product) => (
              <StockCountItemRow
                key={product.id}
                stockCountId={stockCountId}
                product={product}
                unit={unitsById.get(product.base_unit_id)}
                initialValue={countedQuantityByProductId.get(product.id) ?? null}
                readOnly={readOnly}
                onSaved={handleSaved}
              />
            ))}
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-bg py-3">
          <Button onClick={onComplete} disabled={completing || cancelling}>
            {completing ? 'Completando…' : 'Completar Conteo'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={completing || cancelling} className="text-red-600">
            {cancelling ? 'Cancelando…' : 'Cancelar Conteo'}
          </Button>
        </div>
      )}
    </div>
  )
}
