import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'
import { useStore } from '@/features/stores/hooks/useStores'
import { useAllStaffProfiles } from '@/features/stores/hooks/useStoreAccounts'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useAllCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import { useStorePurchaseRequestDetail } from '@/features/store-purchase-requests/hooks/useStorePurchaseRequests'
import {
  formatStorePurchaseRequestDate,
  categoryOrderThenName,
} from '@/features/store-purchase-requests/utils/storePurchaseRequestDisplay'

// Read-only and immutable, same posture as Purchase Order Detail -- this page issues exactly
// one kind of database call: select. Fulfilled Quantity is always 0 and Remaining always equals
// Requested for now -- expected, not a bug, until Supply Fulfillment (the next module) exists.
export function StorePurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: detail, loading, error } = useStorePurchaseRequestDetail(id ?? null)
  const { data: store } = useStore(detail?.request.store_id ?? null)
  const { data: staffProfiles } = useAllStaffProfiles()
  const { data: allProducts } = useProducts({})
  const { data: allCategories } = useAllCategories()
  const { data: units } = useUnits()

  const staffById = useMemo(() => new Map((staffProfiles ?? []).map((staff) => [staff.id, staff])), [staffProfiles])
  const productsById = useMemo(() => new Map((allProducts ?? []).map((product) => [product.id, product])), [allProducts])
  const categoriesById = useMemo(
    () => new Map((allCategories ?? []).map((category) => [category.id, category])),
    [allCategories],
  )
  const unitsById = useMemo(() => new Map((units ?? []).map((unit) => [unit.id, unit])), [units])

  // Category is resolved live from the product's current classification, not snapshotted
  // (approved Technical Design) -- consistent with the project's standard product ordering
  // (Category Order, then Product Name), same rule used everywhere else, no persisted
  // display_order.
  const sortedItems = useMemo(() => {
    const items = [...(detail?.items ?? [])]
    items.sort((a, b) => {
      const categoryIdA = productsById.get(a.product_id)?.category_id ?? ''
      const categoryIdB = productsById.get(b.product_id)?.category_id ?? ''
      return categoryOrderThenName(categoriesById, categoryIdA, a.product_name, categoryIdB, b.product_name)
    })
    return items
  }, [detail, productsById, categoriesById])

  if (loading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (error || !detail) {
    return <p className="text-sm text-red-600">Solicitud no encontrada.</p>
  }

  const { request } = detail
  const submittedByName = request.submitted_by ? (staffById.get(request.submitted_by)?.full_name ?? '—') : '—'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.STORE_PURCHASE_REQUESTS)}
          className="text-sm text-accent hover:underline"
        >
          ← Volver a solicitudes de compra
        </button>
        <h1 className="mt-2 text-lg font-semibold">Solicitud de Compra</h1>
      </div>

      <div className="space-y-2 rounded-md border border-border p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Tienda</dt>
            <dd>{store?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Fecha</dt>
            <dd>{formatStorePurchaseRequestDate(request.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Enviado por</dt>
            <dd>{submittedByName}</dd>
          </div>
          {request.notes && (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Notas</dt>
              <dd className="text-right">{request.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Productos</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-black/[0.02]">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cantidad Solicitada</th>
                <th className="px-3 py-2 font-medium">Cantidad Suministrada</th>
                <th className="px-3 py-2 font-medium">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const product = productsById.get(item.product_id)
                const unit = product ? unitsById.get(product.base_unit_id) : undefined
                const requested = Number(item.requested_quantity)
                // No Supply Fulfillment records exist yet (next module) -- always 0 for now.
                const fulfilled = 0
                const remaining = requested - fulfilled

                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 text-neutral-500">
                      {requested} {unit?.abbreviation ?? ''}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {fulfilled} {unit?.abbreviation ?? ''}
                    </td>
                    <td className="px-3 py-2">
                      {remaining} {unit?.abbreviation ?? ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
