import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { supplySourceEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type SupplySource = Database['public']['Tables']['supply_sources']['Row']

interface SupplySourceTableProps {
  supplySources: SupplySource[]
  canWrite: boolean
  onToggleActive: (supplySource: SupplySource) => void
  togglingId: string | null
}

const resolutionTypeLabels = { external: 'External', internal: 'Internal' } as const

export function SupplySourceTable({ supplySources, canWrite, onToggleActive, togglingId }: SupplySourceTableProps) {
  if (supplySources.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No Supply Sources found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {supplySources.map((supplySource) => (
            <tr key={supplySource.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{supplySource.name}</td>
              <td className="px-3 py-2 text-neutral-500">{resolutionTypeLabels[supplySource.resolution_type]}</td>
              <td className="px-3 py-2 text-neutral-500">{supplySource.sort_order}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    supplySource.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                  )}
                >
                  {supplySource.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link to={supplySourceEditRoute(supplySource.id)} className="text-sm text-accent hover:underline">
                    {canWrite ? 'Edit' : 'View'}
                  </Link>
                  {canWrite && (
                    <Button
                      variant="secondary"
                      onClick={() => onToggleActive(supplySource)}
                      disabled={togglingId === supplySource.id}
                      className="px-2 py-1 text-xs"
                    >
                      {supplySource.is_active ? 'Disable' : 'Enable'}
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
