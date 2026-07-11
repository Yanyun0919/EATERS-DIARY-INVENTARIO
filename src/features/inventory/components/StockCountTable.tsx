import { Link } from 'react-router-dom'
import type { Database } from '@/core/supabase/database.types'
import { stockCountDetailRoute } from '@/shared/constants/routes'
import { statusLabels, statusClasses, formatStockCountDate } from '@/features/inventory/utils/stockCountDisplay'

type StockCount = Database['public']['Tables']['stock_counts']['Row']
type Store = Database['public']['Tables']['stores']['Row']
type StaffProfile = Pick<Database['public']['Tables']['staff_profiles']['Row'], 'id' | 'full_name'>

interface StockCountTableProps {
  stockCounts: StockCount[]
  storesById: Map<string, Store>
  staffById: Map<string, StaffProfile>
}

export function StockCountTable({ stockCounts, storesById, staffById }: StockCountTableProps) {
  if (stockCounts.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No se encontraron conteos de stock.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-black/[0.02]">
            <th className="px-3 py-2 font-medium">Tienda</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Contado Por</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {stockCounts.map((stockCount) => (
            <tr key={stockCount.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{storesById.get(stockCount.store_id)?.name ?? '—'}</td>
              <td className="px-3 py-2 text-neutral-500">
                {formatStockCountDate(stockCount.completed_at ?? stockCount.started_at)}
              </td>
              <td className="px-3 py-2 text-neutral-500">
                {stockCount.counted_by ? (staffById.get(stockCount.counted_by)?.full_name ?? '—') : '—'}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[stockCount.status]}`}>
                  {statusLabels[stockCount.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <Link to={stockCountDetailRoute(stockCount.id)} className="text-sm text-accent hover:underline">
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
