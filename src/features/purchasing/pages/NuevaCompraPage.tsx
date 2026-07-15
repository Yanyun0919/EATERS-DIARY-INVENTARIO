import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useStores } from '@/features/stores/hooks/useStores'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { createPurchaseOrder } from '@/features/purchasing/api/purchaseOrders'
import {
  PurchaseOrderItemsEditor,
  type PendingLineItem,
} from '@/features/purchasing/components/PurchaseOrderItemsEditor'

const selectClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'
const textareaClasses =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// No draft, no resume (approved business design): everything below is local UI state until
// "Crear Compra" writes it in one action. Nothing is saved as the manager fills this in --
// leaving the page discards everything, same as Purchase Suggestions' local-only edits.
export function NuevaCompraPage() {
  const navigate = useNavigate()
  const { profile, isAdministrator, loading: profileLoading } = useStaffProfile()

  const [storeId, setStoreId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PendingLineItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPurchasing = profile?.role === 'purchasing'
  const canView = isAdministrator || isPurchasing

  const { data: stores } = useStores({ isActive: true })
  const { data: suppliers } = useSuppliers({ isActive: true })

  const grandTotal = items.reduce((sum, item) => sum + item.quantityOrdered * item.unitPrice, 0)

  function handleSupplierChange(value: string) {
    setSupplierId(value)
    // Previously-added items were validated against the old supplier's catalog -- clear them
    // rather than carry over items that may no longer make sense for the newly selected one.
    setItems([])
  }

  function handleAddItem(item: PendingLineItem) {
    setItems((prev) => [...prev, item])
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSubmit() {
    if (!storeId) {
      setError('Selecciona una tienda')
      return
    }
    if (!supplierId) {
      setError('Selecciona un proveedor')
      return
    }
    if (items.length === 0) {
      setError('Añade al menos un producto')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await createPurchaseOrder({
        storeId,
        supplierId,
        notes: notes.trim() || null,
        items,
      })
      // Purchase Detail (Page 3) doesn't exist yet -- back to the history list, where the new
      // purchase now appears.
      navigate(ROUTES.PURCHASES)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la compra')
    } finally {
      setSubmitting(false)
    }
  }

  if (profileLoading) {
    return <p className="text-sm text-neutral-500">Cargando…</p>
  }

  if (!canView) {
    return <p className="text-sm text-red-600">No tienes permiso para ver esta página.</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.PURCHASES)} className="text-sm text-accent hover:underline">
          ← Volver a compras
        </button>
        <h1 className="mt-2 text-lg font-semibold">Nueva Compra</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label htmlFor="store" className="text-sm font-medium">
            Tienda
          </label>
          <select id="store" value={storeId} onChange={(event) => setStoreId(event.target.value)} className={selectClasses}>
            <option value="">Selecciona una tienda</option>
            {(stores ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="supplier" className="text-sm font-medium">
            Proveedor
          </label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(event) => handleSupplierChange(event.target.value)}
            className={selectClasses}
          >
            <option value="">Selecciona un proveedor</option>
            {(suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PurchaseOrderItemsEditor supplierId={supplierId || null} items={items} onAdd={handleAddItem} onRemove={handleRemoveItem} />

      {items.length > 0 && (
        <p className="text-sm">
          Importe Total: <strong>{grandTotal.toFixed(2)} €</strong>
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={textareaClasses}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Creando…' : 'Crear Compra'}
      </Button>
    </div>
  )
}
