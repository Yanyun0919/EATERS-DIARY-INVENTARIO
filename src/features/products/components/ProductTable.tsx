import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { productEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Unit = Database['public']['Tables']['units']['Row']

interface ProductTableProps {
  products: Product[]
  categoriesById: Map<string, Category>
  unitsById: Map<string, Unit>
  canWrite: boolean
  onToggleActive: (product: Product) => void
  togglingId: string | null
}

export function ProductTable({
  products,
  categoriesById,
  unitsById,
  canWrite,
  onToggleActive,
  togglingId,
}: ProductTableProps) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No products found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Inventory Unit</th>
            <th className="px-3 py-2 font-medium">Min. Stock</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const category = categoriesById.get(product.category_id)
            const unit = unitsById.get(product.base_unit_id)

            return (
              <tr key={product.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{product.name}</td>
                <td className="px-3 py-2 text-neutral-500">{category?.name ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-500">{unit?.abbreviation ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-500">
                  {product.minimum_stock} {unit?.abbreviation ?? ''}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      product.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                    )}
                  >
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={productEditRoute(product.id)}
                      className="text-sm text-accent hover:underline"
                    >
                      {canWrite ? 'Edit' : 'View'}
                    </Link>
                    {canWrite && (
                      <Button
                        variant="secondary"
                        onClick={() => onToggleActive(product)}
                        disabled={togglingId === product.id}
                        className="px-2 py-1 text-xs"
                      >
                        {product.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
