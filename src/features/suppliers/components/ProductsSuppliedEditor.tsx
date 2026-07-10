import { useState, type FormEvent } from 'react'
import type { Database } from '@/core/supabase/database.types'
import { Button } from '@/shared/components/Button'
import {
  productSupplierFormSchema,
  purchaseUnitOptions,
  type ProductSupplierFormValues,
} from '@/features/suppliers/schemas/supplier'
import {
  upsertProductSupplier,
  deleteProductSupplier,
  type ProductSupplierInput,
} from '@/features/suppliers/api/productSuppliers'

type Product = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'name' | 'base_unit_id'>
type SupplierProduct = Database['public']['Tables']['supplier_products']['Row']

interface ProductsSuppliedEditorProps {
  supplierId: string
  links: SupplierProduct[]
  products: Product[]
  canWrite: boolean
  onChanged: () => void
}

const emptyForm: ProductSupplierFormValues = {
  productId: '',
  supplierSku: '',
  unitPrice: 0,
  purchaseUnit: 'kg',
  purchaseUnitSpec: '',
  moq: 1,
  leadTimeDays: null,
  ivaRate: 10,
  isPreferred: false,
  isAvailable: true,
}

const inputClasses = 'rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent'

export function ProductsSuppliedEditor({ supplierId, links, products, canWrite, onChanged }: ProductsSuppliedEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductSupplierFormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const productsById = new Map(products.map((product) => [product.id, product]))

  function startAdd() {
    setEditingId('new')
    setForm(emptyForm)
    setError(null)
  }

  function startEdit(link: SupplierProduct) {
    setEditingId(link.id)
    setForm({
      productId: link.product_id,
      supplierSku: link.supplier_sku ?? '',
      unitPrice: Number(link.unit_price),
      purchaseUnit: link.purchase_unit,
      purchaseUnitSpec: link.purchase_unit_spec ?? '',
      moq: Number(link.moq),
      leadTimeDays: link.lead_time_days,
      ivaRate: Number(link.iva_rate),
      isPreferred: link.is_preferred,
      isAvailable: link.is_available,
    })
    setError(null)
  }

  function cancel() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = productSupplierFormSchema.safeParse(form)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid value')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const input: ProductSupplierInput = {
        id: editingId !== 'new' ? (editingId ?? undefined) : undefined,
        supplierId,
        productId: result.data.productId,
        supplierSku: result.data.supplierSku || null,
        unitPrice: result.data.unitPrice,
        purchaseUnit: result.data.purchaseUnit,
        purchaseUnitSpec: result.data.purchaseUnit === 'other' ? result.data.purchaseUnitSpec : null,
        moq: result.data.moq,
        leadTimeDays: result.data.leadTimeDays,
        ivaRate: result.data.ivaRate,
        isPreferred: result.data.isPreferred,
        isAvailable: result.data.isAvailable,
      }
      await upsertProductSupplier(input)
      cancel()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteProductSupplier(id)
    onChanged()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Products supplied</h2>
        {canWrite && editingId === null && (
          <Button variant="secondary" onClick={startAdd} className="px-2 py-1 text-xs">
            Add product
          </Button>
        )}
      </div>

      {links.length === 0 && editingId === null && (
        <p className="text-sm text-neutral-500">This supplier doesn't supply any products yet.</p>
      )}

      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.id} className="rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {productsById.get(link.product_id)?.name ?? 'Unknown product'}
                {link.is_preferred && <span className="ml-2 text-xs text-accent">Preferred</span>}
                {!link.is_available && <span className="ml-2 text-xs text-neutral-500">Unavailable</span>}
              </span>
              {canWrite && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(link)} className="text-accent hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(link.id)} className="text-red-600 hover:underline">
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="text-neutral-500">
              {link.unit_price} € / {link.purchase_unit === 'other' ? link.purchase_unit_spec : link.purchase_unit} · MOQ{' '}
              {link.moq} · IVA {link.iva_rate}%
              {link.supplier_sku ? ` · SKU ${link.supplier_sku}` : ''}
              {link.lead_time_days !== null ? ` · ${link.lead_time_days}d lead time` : ''}
            </div>
          </li>
        ))}
      </ul>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Product</label>
              <select
                value={form.productId}
                onChange={(event) => setForm({ ...form, productId: event.target.value })}
                className={inputClasses}
              >
                <option value="">Select…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Supplier SKU</label>
              <input
                value={form.supplierSku}
                onChange={(event) => setForm({ ...form, supplierSku: event.target.value })}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Unit price (€)</label>
              <input
                type="number"
                step="any"
                value={form.unitPrice}
                onChange={(event) => setForm({ ...form, unitPrice: Number(event.target.value) })}
                className={`${inputClasses} w-24`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Purchase Unit</label>
              <select
                value={form.purchaseUnit}
                onChange={(event) =>
                  setForm({ ...form, purchaseUnit: event.target.value as ProductSupplierFormValues['purchaseUnit'] })
                }
                className={inputClasses}
              >
                {purchaseUnitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'other' ? 'Other' : option}
                  </option>
                ))}
              </select>
            </div>
            {form.purchaseUnit === 'other' && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Specification</label>
                <input
                  value={form.purchaseUnitSpec}
                  onChange={(event) => setForm({ ...form, purchaseUnitSpec: event.target.value })}
                  placeholder='e.g. "24 cans/box"'
                  className={`${inputClasses} w-48`}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">MOQ</label>
              <input
                type="number"
                step="any"
                value={form.moq}
                onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })}
                className={`${inputClasses} w-20`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Lead time (days)</label>
              <input
                type="number"
                value={form.leadTimeDays ?? ''}
                onChange={(event) =>
                  setForm({ ...form, leadTimeDays: event.target.value === '' ? null : Number(event.target.value) })
                }
                className={`${inputClasses} w-24`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">IVA (%)</label>
              <input
                type="number"
                step="any"
                value={form.ivaRate}
                onChange={(event) => setForm({ ...form, ivaRate: Number(event.target.value) })}
                className={`${inputClasses} w-20`}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPreferred}
                onChange={(event) => setForm({ ...form, isPreferred: event.target.checked })}
              />
              Preferred supplier for this product
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })}
              />
              Currently available
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting} className="px-2 py-1 text-xs">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={cancel} className="px-2 py-1 text-xs">
              Cancel
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
