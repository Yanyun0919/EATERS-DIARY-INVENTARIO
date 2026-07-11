import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']

interface InventoryFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  categories: Category[]
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function InventoryFilters({ search, onSearchChange, categoryId, onCategoryChange, categories }: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={`${inputClasses} w-64`}
      />

      <select
        value={categoryId}
        onChange={(event) => onCategoryChange(event.target.value)}
        className={inputClasses}
      >
        <option value="">Todas las categorías</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  )
}
