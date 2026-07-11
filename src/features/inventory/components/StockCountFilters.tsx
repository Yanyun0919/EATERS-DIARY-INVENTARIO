export type StatusFilter = 'all' | 'in_progress' | 'completed' | 'cancelled'

interface StockCountFiltersProps {
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function StockCountFilters({ statusFilter, onStatusFilterChange }: StockCountFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}
        className={inputClasses}
      >
        <option value="all">Todos</option>
        <option value="in_progress">En Progreso</option>
        <option value="completed">Completado</option>
        <option value="cancelled">Cancelado</option>
      </select>
    </div>
  )
}
