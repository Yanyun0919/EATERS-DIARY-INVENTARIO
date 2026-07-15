import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { storePurchaseRequestDetailRoute } from '@/shared/constants/routes'
import { formatStorePurchaseRequestDate } from '@/features/store-purchase-requests/utils/storePurchaseRequestDisplay'

type StorePurchaseRequest = Database['public']['Tables']['store_purchase_requests']['Row']
type Store = Database['public']['Tables']['stores']['Row']

interface StorePurchaseRequestsTableProps {
  requests: StorePurchaseRequest[]
  storesById: Map<string, Store>
}

// A dedicated "Ver" action column (not a whole-row click) -- same pattern as
// PurchaseOrdersTable/StockCountTable.
export function StorePurchaseRequestsTable({ requests, storesById }: StorePurchaseRequestsTableProps) {
  if (requests.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No se encontraron solicitudes de compra.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Tienda</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Notas</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{storesById.get(request.store_id)?.name ?? '—'}</td>
              <td className="px-3 py-2 text-neutral-500">{formatStorePurchaseRequestDate(request.created_at)}</td>
              <td className="px-3 py-2 text-neutral-500">{request.notes ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <Link to={storePurchaseRequestDetailRoute(request.id)} className="text-sm text-accent hover:underline">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
