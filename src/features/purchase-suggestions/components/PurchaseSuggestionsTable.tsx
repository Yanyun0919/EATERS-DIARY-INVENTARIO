import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

export type SuggestionStatus = 'not_counted' | 'low_stock'

export interface SuggestionRow {
  product: Product
  status: SuggestionStatus
  currentStock: number | null
  suggestedQuantity: number | null
}

interface PurchaseSuggestionsTableProps {
  rows: SuggestionRow[]
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
  quantityOverrides: Map<string, string>
  onQuantityChange: (productId: string, value: string) => void
}

const statusLabels: Record<SuggestionStatus, string> = {
  not_counted: 'Sin Contar',
  low_stock: 'Stock Bajo',
}

const statusClasses: Record<SuggestionStatus, string> = {
  not_counted: 'bg-neutral-200 text-neutral-600',
  low_stock: 'bg-amber-100 text-amber-800',
}

// Cantidad Sugerida = Stock Mínimo - Stock Actual, nothing else, and only for Stock Bajo rows --
// Sin Contar rows never get a calculated suggestion (their real stock is unknown, not zero).
// Edits are local UI state only (quantityOverrides, owned by the page) -- never saved; a
// refresh regenerates everything fresh from Inventory.
export function PurchaseSuggestionsTable({
  rows,
  categoriesById,
  unitsById,
  quantityOverrides,
  onQuantityChange,
}: PurchaseSuggestionsTableProps) {
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
            <th className="px-3 py-2 font-medium">Cantidad Sugerida</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, status, currentStock, suggestedQuantity }) => {
            const category = categoriesById.get(product.category_id)
            const unit = unitsById.get(product.base_unit_id)
            const value = quantityOverrides.get(product.id) ?? (suggestedQuantity !== null ? String(suggestedQuantity) : '')

            return (
              <tr key={product.id} className="border-b border-border last:border-0">
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
                  {status === 'low_stock' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={value}
                        onChange={(event) => onQuantityChange(product.id, event.target.value)}
                        className="w-24 rounded-md border border-border bg-transparent px-2 py-1.5 text-right text-sm outline-none focus:border-accent"
                      />
                      <span className="text-xs text-neutral-500">{unit?.abbreviation ?? ''}</span>
                    </div>
                  ) : (
                    <span className="text-neutral-500">—</span>
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
