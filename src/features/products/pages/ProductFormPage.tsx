import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { ROUTES, productEditRoute } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'
import { getProduct, createProduct, updateProduct } from '@/features/products/api/products'
import { useCategories, useUnits, useSuppliers } from '@/features/products/hooks/useProductLookups'
import {
  useSupplierProducts,
  useUnitConversions,
  useAliases,
} from '@/features/products/hooks/useProductRelations'
import { ProductForm } from '@/features/products/components/ProductForm'
import { SupplierLinksEditor } from '@/features/products/components/SupplierLinksEditor'
import { UnitConversionsEditor } from '@/features/products/components/UnitConversionsEditor'
import { ProductAliasesEditor } from '@/features/products/components/ProductAliasesEditor'
import type { ProductFormValues } from '@/features/products/schemas/product'
import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']

const emptyFormValues: ProductFormValues = {
  name: '',
  sku: '',
  categoryId: '',
  baseUnitId: '',
  isStockTracked: true,
}

function toFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku ?? '',
    categoryId: product.category_id ?? '',
    baseUnitId: product.base_unit_id,
    isStockTracked: product.is_stock_tracked,
  }
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const { canWriteMasterData, loading: profileLoading } = useStaffProfile()

  const [product, setProduct] = useState<Product | null>(null)
  const [productLoading, setProductLoading] = useState(!isNew)
  const [productError, setProductError] = useState<string | null>(null)

  const { data: categories } = useCategories()
  const { data: units } = useUnits()
  const { data: suppliers } = useSuppliers()
  const { data: supplierLinks, refetch: refetchLinks } = useSupplierProducts(id ?? null)
  const { data: conversions, refetch: refetchConversions } = useUnitConversions(id ?? null)
  const { data: aliases, refetch: refetchAliases } = useAliases(id ?? null)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    setProductLoading(true)
    getProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setProductError(err instanceof Error ? err.message : 'Failed to load product')
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  if (profileLoading || productLoading) {
    return <LoadingScreen />
  }

  if (!isNew && !product) {
    return <p className="text-sm text-red-600">{productError ?? 'Product not found.'}</p>
  }

  const readOnly = !canWriteMasterData

  async function handleSubmit(values: ProductFormValues) {
    const input = {
      name: values.name,
      sku: values.sku || null,
      categoryId: values.categoryId || null,
      baseUnitId: values.baseUnitId,
      isStockTracked: values.isStockTracked,
    }

    if (isNew) {
      const created = await createProduct(input)
      navigate(productEditRoute(created.id), { replace: true })
      return
    }

    if (!id) return
    const updated = await updateProduct(id, input)
    setProduct(updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={() => navigate(ROUTES.PRODUCTS)} className="text-sm text-accent hover:underline">
          ← Back to products
        </button>
        <h1 className="mt-2 text-lg font-semibold">{isNew ? 'Add Product' : product?.name}</h1>
      </div>

      <ProductForm
        initialValues={product ? toFormValues(product) : emptyFormValues}
        categories={categories ?? []}
        units={units ?? []}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create Product' : 'Save changes'}
        readOnly={readOnly}
      />

      {isNew ? (
        <p className="text-sm text-neutral-500">
          Save the product first to add suppliers, unit conversions, or barcodes/translations.
        </p>
      ) : (
        <div className="max-w-2xl space-y-6 border-t border-border pt-6">
          <SupplierLinksEditor
            productId={id!}
            links={supplierLinks ?? []}
            suppliers={suppliers ?? []}
            units={units ?? []}
            canWrite={canWriteMasterData}
            onChanged={refetchLinks}
          />
          <UnitConversionsEditor
            productId={id!}
            conversions={conversions ?? []}
            units={units ?? []}
            canWrite={canWriteMasterData}
            onChanged={refetchConversions}
          />
          <ProductAliasesEditor
            productId={id!}
            aliases={aliases ?? []}
            canWrite={canWriteMasterData}
            onChanged={refetchAliases}
          />
        </div>
      )}
    </div>
  )
}
