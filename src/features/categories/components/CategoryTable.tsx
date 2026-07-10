import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { categoryEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type Category = Database['public']['Tables']['categories']['Row']

interface CategoryTableProps {
  categories: Category[]
  canWrite: boolean
  onToggleActive: (category: Category) => void
  togglingId: string | null
}

export function CategoryTable({ categories, canWrite, onToggleActive, togglingId }: CategoryTableProps) {
  if (categories.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No categories found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{category.name}</td>
              <td className="px-3 py-2 text-neutral-500">{category.sort_order}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    category.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                  )}
                >
                  {category.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link to={categoryEditRoute(category.id)} className="text-sm text-accent hover:underline">
                    {canWrite ? 'Edit' : 'View'}
                  </Link>
                  {canWrite && (
                    <Button
                      variant="secondary"
                      onClick={() => onToggleActive(category)}
                      disabled={togglingId === category.id}
                      className="px-2 py-1 text-xs"
                    >
                      {category.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
