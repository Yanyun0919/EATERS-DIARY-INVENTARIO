export type ActiveFilter = 'active' | 'inactive' | 'all'

interface SupplySourceFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  activeFilter: ActiveFilter
  onActiveFilterChange: (value: ActiveFilter) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function SupplySourceFilters({
  search,
  onSearchChange,
  activeFilter,
  onActiveFilterChange,
}: SupplySourceFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={`${inputClasses} w-64`}
      />

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
