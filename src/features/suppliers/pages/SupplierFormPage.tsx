import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, supplierEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { getSupplier, createSupplier, updateSupplier } from '@/features/suppliers/api/suppliers'
import { useProductsSuppliedBy, useProductsForPicker } from '@/features/suppliers/hooks/useProductSuppliers'
import { SupplierForm } from '@/features/suppliers/components/SupplierForm'
import { ProductsSuppliedEditor } from '@/features/suppliers/components/ProductsSuppliedEditor'
import type { SupplierFormValues } from '@/features/suppliers/schemas/supplier'
import type { Database } from '@/core/supabase/database.types'

type Supplier = Database['public']['Tables']['suppliers']['Row']

const emptyFormValues: SupplierFormValues = {
  name: '',
  nifCif: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  paymentTerms: '',
}

function toFormValues(supplier: Supplier): SupplierFormValues {
  return {
    name: supplier.name,
    nifCif: supplier.nif_cif ?? '',
    contactName: supplier.contact_name ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    address: supplier.address ?? '',
    paymentTerms: supplier.payment_terms ?? '',
  }
}

export function SupplierFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [supplierLoading, setSupplierLoading] = useState(!isNew)
  const [supplierError, setSupplierError] = useState<string | null>(null)

  const { data: products } = useProductsForPicker()
  const { data: links, refetch: refetchLinks } = useProductsSuppliedBy(id ?? null)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setSupplierLoading(true)
    getSupplier(id)
      .then((data) => {
        if (!cancelled) setSupplier(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setSupplierError(err instanceof Error ? err.message : 'Failed to load supplier')
      })
      .finally(() => {
        if (!cancelled) setSupplierLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  if (profileLoading || supplierLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !supplier) {
    return <p className="text-sm text-red-600">{supplierError ?? 'Supplier not found.'}</p>
  }

  const readOnly = !canWriteMasterData

  async function handleSubmit(values: SupplierFormValues) {
    const input = {
      name: values.name,
      nifCif: values.nifCif || null,
      contactName: values.contactName || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      paymentTerms: values.paymentTerms || null,
    }

    if (isNew) {
      const created = await createSupplier(input)
      navigate(supplierEditRoute(created.id), { replace: true })
      return
    }

    if (!id) return
    const updated = await updateSupplier(id, input)
    setSupplier(updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.SUPPLIERS)} className="text-sm text-accent hover:underline">
          ← Back to suppliers
        </button>
        <h1 className="mt-2 text-lg font-semibold">{isNew ? 'Add Supplier' : supplier?.name}</h1>
      </div>

      <SupplierForm
        initialValues={supplier ? toFormValues(supplier) : emptyFormValues}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create Supplier' : 'Save changes'}
        readOnly={readOnly}
      />

      {isNew ? (
        <p className="text-sm text-neutral-500">Save the supplier first to add the products it supplies.</p>
      ) : (
        <div className="max-w-2xl border-t border-border pt-6">
          <ProductsSuppliedEditor
            supplierId={id!}
            links={links ?? []}
            products={products ?? []}
            canWrite={canWriteMasterData}
            onChanged={refetchLinks}
          />
        </div>
      )}
    </div>
  )
}
