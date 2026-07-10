import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { storeEditRoute } from '@/shared/constants/routes'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils/cn'

type Store = Database['public']['Tables']['stores']['Row']

const storeTypeLabels: Record<Store['type'], string> = {
  production_center: 'Production Center',
  retail_store: 'Retail Store',
}

interface StoreTableProps {
  stores: Store[]
  canWrite: boolean
  onToggleActive: (store: Store) => void
  togglingId: string | null
  accountNamesByStore: Map<string, string[]>
  capabilityNamesByStore: Map<string, string[]>
}

export function StoreTable({
  stores,
  canWrite,
  onToggleActive,
  togglingId,
  accountNamesByStore,
  capabilityNamesByStore,
}: StoreTableProps) {
  if (stores.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No stores found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Login Account(s)</th>
            <th className="px-3 py-2 font-medium">Capabilities</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => {
            const accountNames = accountNamesByStore.get(store.id) ?? []
            const capabilityNames = capabilityNamesByStore.get(store.id) ?? []
            return (
              <tr key={store.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{store.name}</td>
                <td className="px-3 py-2 text-neutral-500">{store.code}</td>
                <td className="px-3 py-2 text-neutral-500">{storeTypeLabels[store.type]}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      store.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600',
                    )}
                  >
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {accountNames.length > 0 ? accountNames.join(', ') : '—'}
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {capabilityNames.length > 0 ? capabilityNames.join(', ') : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to={storeEditRoute(store.id)} className="text-sm text-accent hover:underline">
                      {canWrite ? 'Edit' : 'View'}
                    </Link>
                    {canWrite && (
                      <Button
                        variant="secondary"
                        onClick={() => onToggleActive(store)}
                        disabled={togglingId === store.id}
                        className="px-2 py-1 text-xs"
                      >
                        {store.is_active ? 'Disable' : 'Enable'}
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
