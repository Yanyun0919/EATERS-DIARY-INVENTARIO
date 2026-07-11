import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']
type Inventory = Database['public']['Tables']['inventory']['Row']

interface InventoryTableProps {
  products: Product[]
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
  inventoryByProductId: Map<string, Inventory>
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-ES')
}

export function InventoryTable({ products, categoriesById, unitsById, inventoryByProductId }: InventoryTableProps) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No se encontraron productos.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Producto</th>
            <th className="px-3 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Stock Actual</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Último Conteo</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const category = categoriesById.get(product.category_id)
            const unit = unitsById.get(product.base_unit_id)
            const inventory = inventoryByProductId.get(product.id)
            const isLowStock = inventory !== undefined && Number(inventory.quantity_on_hand) < Number(product.minimum_stock)

            return (
              <tr key={product.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{product.name}</td>
                <td className="px-3 py-2 text-neutral-500">{category?.name ?? '—'}</td>
                <td className="px-3 py-2">
                  {inventory ? (
                    <span>
                      {inventory.quantity_on_hand} {unit?.abbreviation ?? ''}
                    </span>
                  ) : (
                    <span className="text-neutral-500">Sin Contar</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isLowStock && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Stock Bajo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-500">{formatDate(inventory?.last_counted_at ?? null)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
