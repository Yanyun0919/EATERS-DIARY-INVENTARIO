import { useState } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'

type Product = Database['public']['Tables']['products']['Row']

interface AddDraftProductProps {
  // Already scoped by the parent to stock-tracked products not already shown as a suggestion
  // and not already manually added -- avoids the same product ever appearing twice on screen.
  availableProducts: Product[]
  onAdd: (productId: string) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// Manual addition (approved Business Architecture: "the Store Manager may... manually add
// additional products") -- for a product that isn't currently flagged low-stock but the Store
// Manager wants to request anyway (e.g. buying ahead of an event). Scoped to stock-tracked
// products only, same universe as the rest of the Draft.
export function AddDraftProduct({ availableProducts, onAdd }: AddDraftProductProps) {
  const [selectedProductId, setSelectedProductId] = useState('')

  function handleAdd() {
    if (!selectedProductId) return
    onAdd(selectedProductId)
    setSelectedProductId('')
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">Añadir producto</label>
        <select
          value={selectedProductId}
          onChange={(event) => setSelectedProductId(event.target.value)}
          className={`${inputClasses} w-64`}
        >
          <option value="">Selecciona un producto…</option>
          {availableProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" variant="secondary" onClick={handleAdd} disabled={!selectedProductId} className="px-2 py-1.5 text-xs">
        Añadir Producto
      </Button>
    </div>
  )
}
