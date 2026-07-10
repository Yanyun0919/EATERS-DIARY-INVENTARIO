import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { supplierEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type Supplier = Database['public']['Tables']['suppliers']['Row']

interface SupplierTableProps {
  suppliers: Supplier[]
  canWrite: boolean
  onToggleActive: (supplier: Supplier) => void
  togglingId: string | null
}

export function SupplierTable({ suppliers, canWrite, onToggleActive, togglingId }: SupplierTableProps) {
  if (suppliers.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No suppliers found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{supplier.name}</td>
              <td className="px-3 py-2 text-neutral-500">{supplier.contact_name ?? '—'}</td>
              <td className="px-3 py-2 text-neutral-500">{supplier.phone ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    supplier.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                  )}
                >
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link to={supplierEditRoute(supplier.id)} className="text-sm text-accent hover:underline">
                    {canWrite ? 'Edit' : 'View'}
                  </Link>
                  {canWrite && (
                    <Button
                      variant="secondary"
                      onClick={() => onToggleActive(supplier)}
                      disabled={togglingId === supplier.id}
                      className="px-2 py-1 text-xs"
                    >
                      {supplier.is_active ? 'Disable' : 'Enable'}
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
