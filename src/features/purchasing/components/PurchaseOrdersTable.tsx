import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import type { PurchaseOrderWithTotal } from '@/features/purchasing/api/purchaseOrders'
import { purchaseDetailRoute } from '@/shared/constants/routes'
import { formatMoney, formatPurchaseDate } from '@/features/purchasing/utils/purchasingDisplay'

type Store = Database['public']['Tables']['stores']['Row']

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrderWithTotal[]
  storesById: Map<string, Store>
}

// A dedicated "Ver" action column (not a whole-row click) -- same pattern as
// StockCountTable.tsx, chosen so a future action (e.g. reprint/export) can be added alongside it
// later without restructuring the table.
export function PurchaseOrdersTable({ purchaseOrders, storesById }: PurchaseOrdersTableProps) {
  if (purchaseOrders.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No se encontraron compras.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Tienda</th>
            <th className="px-3 py-2 font-medium">Proveedor</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Total</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.map((order) => (
            <tr key={order.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{storesById.get(order.store_id)?.name ?? '—'}</td>
              {/* supplier_name is a snapshot on the row itself, not a live lookup -- it's the
                  supplier's name as it was at the time of purchase, which is the correct value
                  to show on a historical record even if the supplier has since been renamed. */}
              <td className="px-3 py-2 text-neutral-500">{order.supplier_name}</td>
              <td className="px-3 py-2 text-neutral-500">{formatPurchaseDate(order.order_date)}</td>
              <td className="px-3 py-2">{formatMoney(order.total)}</td>
              <td className="px-3 py-2 text-right">
                <Link to={purchaseDetailRoute(order.id)} className="text-sm text-accent hover:underline">
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
