import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { Button } from '@/shared/components/Button'
import { ROUTES } from '@/shared/constants/routes'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { setCategoryActive } from '@/features/categories/api/categories'
import { CategoryFilters, type ActiveFilter } from '@/features/categories/components/CategoryFilters'
import { CategoryTable } from '@/features/categories/components/CategoryTable'
import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']

export function CategoryListPage() {
  const { canWriteMasterData } = useStaffProfile()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)

  const {
    data: categories,
    loading,
    error,
    refetch,
  } = useCategories({
    search: debouncedSearch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  async function handleToggleActive(category: Category) {
    setTogglingId(category.id)
    try {
      await setCategoryActive(category.id, !category.is_active)
      refetch()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Product Categories</h1>
        {canWriteMasterData && (
          <Link to={ROUTES.CATEGORY_NEW}>
            <Button>Add Category</Button>
          </Link>
        )}
      </div>

      <CategoryFilters
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
      />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!loading && !error && (
        <CategoryTable
          categories={categories ?? []}
          canWrite={canWriteMasterData}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
        />
      )}
    </div>
  )
}
