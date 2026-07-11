import type { Database } from '@/core/supabase/database.types'

type StockCountItem = Pick<Database['public']['Tables']['stock_count_items']['Row'], 'id' | 'product_id' | 'counted_quantity'>
type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface StockCountedListProps {
  items: StockCountItem[]
  productsById: Map<string, Product>
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
}

// Store Staff's view of a completed count: Stock Contado only. Reuses the same counting-only
// query as the live counting screen (listStockCountItemsForCounting), which never selects
// expected_quantity/variance -- Stock Anterior and Diferencia never reach this screen at all,
// not just hidden by the UI.
export function StockCountedList({ items, productsById, categoriesById, unitsById }: StockCountedListProps) {
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
            <th className="px-3 py-2 font-medium">Stock Contado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const product = productsById.get(item.product_id)
            const category = product ? categoriesById.get(product.category_id) : undefined
            const unit = product ? unitsById.get(product.base_unit_id) : undefined

            return (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{product?.name ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-500">{category?.name ?? '—'}</td>
                <td className="px-3 py-2">
                  {item.counted_quantity} {unit?.abbreviation ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
