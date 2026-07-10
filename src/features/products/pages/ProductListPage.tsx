import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useCategories, useAllCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { setProductActive } from '@/features/products/api/products'
import { ProductFilters, type ActiveFilter } from '@/features/products/components/ProductFilters'
import { ProductTable } from '@/features/products/components/ProductTable'
import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']

export function ProductListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)
  const { data: categories } = useCategories()
  const { data: allCategories } = useAllCategories()
  const { data: units } = useUnits()

  const {
    data: products,
    loading,
    error,
    refetch,
  } = useProducts({
    search: debouncedSearch,
    categoryId: categoryId || null,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  const categoriesById = useMemo(
    () => new Map((allCategories ?? []).map((category) => [category.id, category])),
    [allCategories],
  )
  const unitsById = useMemo(() => new Map((units ?? []).map((unit) => [unit.id, unit])), [units])

  async function handleToggleActive(product: Product) {
    setTogglingId(product.id)
    try {
      await setProductActive(product.id, !product.is_active)
      refetch()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Products</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.PRODUCT_NEW}>
            <Button>Add Product</Button>
          </Link>
        )}
      </div>

      <ProductFilters
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        categories={categories ?? []}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <ProductTable
          products={products ?? []}
          categoriesById={categoriesById}
          unitsById={unitsById}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
        />
      )}
    </div>
  )
}
