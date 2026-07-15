import { useState } from 'react'
import type { PurchaseUnitType } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import { useProductsSuppliedBy, useProductsForPicker } from '@/features/suppliers/hooks/useProductSuppliers'
import { formatPurchaseUnit, formatMoney } from '@/features/purchasing/utils/purchasingDisplay'

export interface PendingLineItem {
  productId: string
  productName: string
  supplierProductId: string
  quantityOrdered: number
  unitPrice: number
  ivaRate: number
  purchaseUnit: PurchaseUnitType
  purchaseUnitSpec: string | null
}

interface PurchaseOrderItemsEditorProps {
  supplierId: string | null
  items: PendingLineItem[]
  onAdd: (item: PendingLineItem) => void
  onRemove: (index: number) => void
}

const inputClasses = 'rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent'

// The product picker is scoped to this supplier's own catalog (supplier_products) -- a manager
// can only buy here what this supplier actually sells, matching "add line items against that
// supplier's catalog" from the approved design. Purchase Unit/Spec are copied from the chosen
// supplier_products row, not manually typed -- they describe how the supplier packages the
// product, not a per-purchase negotiation term. Quantity and Unit Price are freely editable
// (Unit Price pre-filled from Master Data, per "only modify price when the supplier price has
// changed" -- BUSINESS_RULES.md #5). IVA is never shown or entered here at all -- it's resolved
// silently from the selected supplier_products row at add-time, per "the purchaser should not
// even need to think about tax" (BUSINESS_RULES.md #5, Tax (IVA)).
export function PurchaseOrderItemsEditor({ supplierId, items, onAdd, onRemove }: PurchaseOrderItemsEditorProps) {
  const { data: supplierProducts } = useProductsSuppliedBy(supplierId)
  const { data: products } = useProductsForPicker()

  const [selectedSupplierProductId, setSelectedSupplierProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productsById = new Map((products ?? []).map((product) => [product.id, product]))
  const availableSupplierProducts = (supplierProducts ?? []).filter((sp) => sp.is_available)
  const selectedSupplierProduct = availableSupplierProducts.find((sp) => sp.id === selectedSupplierProductId)

  function handleSelectProduct(supplierProductId: string) {
    setSelectedSupplierProductId(supplierProductId)
    const supplierProduct = availableSupplierProducts.find((sp) => sp.id === supplierProductId)
    setUnitPrice(supplierProduct ? String(supplierProduct.unit_price) : '')
  }

  function handleAdd() {
    const product = selectedSupplierProduct ? productsById.get(selectedSupplierProduct.product_id) : undefined
    if (!selectedSupplierProduct || !product) {
      setError('Selecciona un producto')
      return
    }
    const parsedQuantity = Number(quantity)
    const parsedUnitPrice = Number(unitPrice)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('La cantidad debe ser mayor que cero')
      return
    }
    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      setError('El precio unitario no puede ser negativo')
      return
    }

    onAdd({
      productId: product.id,
      productName: product.name,
      supplierProductId: selectedSupplierProduct.id,
      quantityOrdered: parsedQuantity,
      unitPrice: parsedUnitPrice,
      ivaRate: Number(selectedSupplierProduct.iva_rate),
      purchaseUnit: selectedSupplierProduct.purchase_unit,
      purchaseUnitSpec: selectedSupplierProduct.purchase_unit_spec,
    })

    setSelectedSupplierProductId('')
    setQuantity('')
    setUnitPrice('')
    setError(null)
  }

  if (!supplierId) {
    return <p className="text-sm text-neutral-500">Selecciona un proveedor para añadir productos.</p>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Productos</h2>

      {items.length === 0 && <p className="text-sm text-neutral-500">Aún no has añadido ningún producto.</p>}

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={`${item.supplierProductId}-${index}`} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.productName}</span>
                <button type="button" onClick={() => onRemove(index)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </div>
              <div className="text-neutral-500">
                {item.quantityOrdered} {formatPurchaseUnit(item.purchaseUnit, item.purchaseUnitSpec)} ×{' '}
                {formatMoney(item.unitPrice)} = {formatMoney(item.quantityOrdered * item.unitPrice)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {availableSupplierProducts.length === 0 ? (
        <p className="text-sm text-neutral-500">Este proveedor no tiene productos disponibles.</p>
      ) : (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Producto</label>
              <select
                value={selectedSupplierProductId}
                onChange={(event) => handleSelectProduct(event.target.value)}
                className={inputClasses}
              >
                <option value="">Selecciona…</option>
                {availableSupplierProducts.map((supplierProduct) => (
                  <option key={supplierProduct.id} value={supplierProduct.id}>
                    {productsById.get(supplierProduct.product_id)?.name ?? 'Producto desconocido'}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplierProduct && (
              <span className="pb-2 text-xs text-neutral-500">
                Unidad de compra: {formatPurchaseUnit(selectedSupplierProduct.purchase_unit, selectedSupplierProduct.purchase_unit_spec)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Cantidad</label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${inputClasses} w-24`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Precio Unitario (€)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                className={`${inputClasses} w-28`}
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleAdd} className="px-2 py-1.5 text-xs">
              Añadir Producto
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
