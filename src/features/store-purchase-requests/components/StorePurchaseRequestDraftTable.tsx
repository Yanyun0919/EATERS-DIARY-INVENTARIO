import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

export type DraftRowStatus = 'not_counted' | 'low_stock' | 'manual'

export interface DraftRow {
  product: Product
  status: DraftRowStatus
  currentStock: number | null
  suggestedQuantity: number | null
}

interface StorePurchaseRequestDraftTableProps {
  rows: DraftRow[]
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
  quantityOverrides: Map<string, string>
  onQuantityChange: (productId: string, value: string) => void
  removedProductIds: Set<string>
  onToggleRemoved: (productId: string) => void
  onRemoveManualRow: (productId: string) => void
}

const statusLabels: Record<DraftRowStatus, string> = {
  not_counted: 'Sin Contar',
  low_stock: 'Stock Bajo',
  manual: 'Añadido',
}

const statusClasses: Record<DraftRowStatus, string> = {
  not_counted: 'bg-neutral-200 text-neutral-600',
  low_stock: 'bg-amber-100 text-amber-800',
  manual: 'bg-blue-100 text-blue-800',
}

// Evolves PurchaseSuggestionsTable with the three capabilities the Store Manager Review step
// requires (approved Business Architecture): modify suggested quantity (already existed),
// remove a suggested item, and manually add additional products. Cantidad Sugerida logic is
// unchanged -- Stock Mínimo - Stock Actual, only for Stock Bajo rows; Sin Contar rows never get
// a calculated suggestion (real stock unknown, not zero) and have no quantity input here at
// all -- requesting an uncounted product is done via the manual-add picker instead, so there's
// never two different ways to specify a quantity for the same product on this screen.
export function StorePurchaseRequestDraftTable({
  rows,
  categoriesById,
  unitsById,
  quantityOverrides,
  onQuantityChange,
  removedProductIds,
  onToggleRemoved,
  onRemoveManualRow,
}: StorePurchaseRequestDraftTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-neutral-700">No hay sugerencias de compra.</p>
        <p className="text-sm text-neutral-500">Todos los productos cumplen el Stock Mínimo.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Producto</th>
            <th className="px-3 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Stock Actual</th>
            <th className="px-3 py-2 font-medium">Cantidad Solicitada</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, status, currentStock, suggestedQuantity }) => {
            const category = categoriesById.get(product.category_id)
            const unit = unitsById.get(product.base_unit_id)
            const isRemoved = status === 'low_stock' && removedProductIds.has(product.id)
            const value = quantityOverrides.get(product.id) ?? (suggestedQuantity !== null ? String(suggestedQuantity) : '')

            return (
              <tr key={product.id} className={`border-b border-border last:border-0 ${isRemoved ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2">{product.name}</td>
                <td className="px-3 py-2 text-neutral-500">{category?.name ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}>
                    {statusLabels[status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {currentStock !== null ? `${currentStock} ${unit?.abbreviation ?? ''}` : 'Sin Contar'}
                </td>
                <td className="px-3 py-2">
                  {status !== 'not_counted' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={value}
                        disabled={isRemoved}
                        onChange={(event) => onQuantityChange(product.id, event.target.value)}
                        className="w-24 rounded-md border border-border bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-accent disabled:opacity-50"
                      />
                      <span className="text-xs text-neutral-500">{unit?.abbreviation ?? ''}</span>
                    </div>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {status === 'low_stock' && (
                    <button
                      type="button"
                      onClick={() => onToggleRemoved(product.id)}
                      className="text-sm text-accent hover:underline"
                    >
                      {isRemoved ? 'Deshacer' : 'Quitar'}
                    </button>
                  )}
                  {status === 'manual' && (
                    <button
                      type="button"
                      onClick={() => onRemoveManualRow(product.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
