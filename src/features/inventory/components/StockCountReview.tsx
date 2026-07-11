import type { Database } from '@/core/supabase/database.types'

type StockCountItem = Database['public']['Tables']['stock_count_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface StockCountReviewProps {
  items: StockCountItem[]
  productsById: Map<string, Product>
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
}

// Administrator-only screen (BUSINESS_RULES.md section 3): Stock Anterior, Stock Contado, and
// Diferencia are only ever fetched/rendered here, never on the counting screen.
export function StockCountReview({ items, productsById, categoriesById, unitsById }: StockCountReviewProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">Este conteo no tiene productos.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Producto</th>
            <th className="px-3 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Stock Anterior</th>
            <th className="px-3 py-2 font-medium">Stock Contado</th>
            <th className="px-3 py-2 font-medium">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const product = productsById.get(item.product_id)
            const category = product ? categoriesById.get(product.category_id) : undefined
            const unit = product ? unitsById.get(product.base_unit_id) : undefined
            const variance = Number(item.variance)

            return (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{product?.name ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-500">{category?.name ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-500">
                  {item.expected_quantity} {unit?.abbreviation ?? ''}
                </td>
                <td className="px-3 py-2">
                  {item.counted_quantity} {unit?.abbreviation ?? ''}
                </td>
                <td className={`px-3 py-2 ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-neutral-500'}`}>
                  {variance > 0 ? '+' : ''}
                  {item.variance} {unit?.abbreviation ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
