import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']
export type ActiveFilter = 'active' | 'inactive' | 'all'

interface ProductFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  categories: Category[]
  activeFilter: ActiveFilter
  onActiveFilterChange: (value: ActiveFilter) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function ProductFilters({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  activeFilter,
  onActiveFilterChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Search by name or SKU…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={`${inputClasses} w-64`}
      />

      <select
        value={categoryId}
        onChange={(event) => onCategoryChange(event.target.value)}
        className={inputClasses}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <select
        value={activeFilter}
        onChange={(event) => onActiveFilterChange(event.target.value as ActiveFilter)}
        className={inputClasses}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </select>
    </div>
  )
}
