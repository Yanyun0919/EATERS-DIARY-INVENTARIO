import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES } from '@/shared/constants/routes'
import { useStore } from '@/features/stores/hooks/useStores'
import { useAllStaffProfiles } from '@/features/stores/hooks/useStoreAccounts'
import { usePurchaseOrderDetail } from '@/features/purchasing/hooks/usePurchaseOrders'
import { formatMoney, formatPurchaseUnit, formatPurchaseNumber, formatPurchaseDate } from '@/features/purchasing/utils/purchasingDisplay'

// Page 3 -- read-only and immutable by design (BUSINESS_RULES.md #5, Purchasing Is Operational /
// #9 Page 3 no edit / no delete / no cancel / no inventory updates). This page issues exactly one
// kind of database call: select. There is no mutating action anywhere on it.
export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, isAdministrator, loading: profileLoading } = useStaffProfile()

  const isPurchasing = profile?.role === 'purchasing'
  const canView = isAdministrator || isPurchasing

  const { data: detail, loading: detailLoading, error: detailError } = usePurchaseOrderDetail(canView ? (id ?? null) : null)
  const { data: store } = useStore(detail?.order.store_id ?? null)
  const { data: staffProfiles } = useAllStaffProfiles()

  const staffById = useMemo(() => new Map((staffProfiles ?? []).map((staff) => [staff.id, staff])), [staffProfiles])

  const totals = useMemo(() => {
    const items = detail?.items ?? []
    const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0)
    const iva = items.reduce((sum, item) => sum + (Number(item.line_total) * Number(item.iva_rate)) / 100, 0)
    return { subtotal, iva, total: subtotal + iva }
  }, [detail])

  if (profileLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (!canView) {
    return <p className="text-sm text-red-600">No tienes permiso para ver esta página.</p>
  }

  if (detailLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (detailError || !detail) {
    return <p className="text-sm text-red-600">Compra no encontrada.</p>
  }

  const { order, items } = detail
  const createdByName = order.created_by ? (staffById.get(order.created_by)?.full_name ?? '—') : '—'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.PURCHASES)} className="text-sm text-accent hover:underline">
          ← Volver a compras
        </button>
        <h1 className="mt-2 text-lg font-semibold">{formatPurchaseNumber(order.purchase_number)}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Información de la Compra</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Tienda</dt>
              <dd>{store?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Proveedor</dt>
              {/* supplier_name is a snapshot -- the supplier's name as it was at purchase time. */}
              <dd>{order.supplier_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Fecha</dt>
              <dd>{formatPurchaseDate(order.order_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Creado por</dt>
              <dd>{createdByName}</dd>
            </div>
            {order.notes && (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Notas</dt>
                <dd className="text-right">{order.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-2 rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Resumen Financiero</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Subtotal</dt>
              <dd>{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">IVA</dt>
              <dd>{formatMoney(totals.iva)}</dd>
            </div>
            <div className="flex justify-between gap-4 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Productos</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-black/[0.02]">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Precio Unitario</th>
                <th className="px-3 py-2 font-medium">Total Línea</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{item.product_name}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {item.quantity_ordered} {formatPurchaseUnit(item.purchase_unit, item.purchase_unit_spec)}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{formatMoney(Number(item.unit_price))}</td>
                  <td className="px-3 py-2">{formatMoney(Number(item.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
