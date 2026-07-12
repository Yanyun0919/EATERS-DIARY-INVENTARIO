import type { StaffRole } from '@/core/supabase/database.types'

export type ActiveFilter = 'active' | 'inactive' | 'all'
export type RoleFilter = StaffRole | 'all'

interface StaffFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  roleFilter: RoleFilter
  onRoleFilterChange: (value: RoleFilter) => void
  activeFilter: ActiveFilter
  onActiveFilterChange: (value: ActiveFilter) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function StaffFilters({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  activeFilter,
  onActiveFilterChange,
}: StaffFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Buscar por nombre o email…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={`${inputClasses} w-64`}
      />

      <select
        value={roleFilter}
        onChange={(event) => onRoleFilterChange(event.target.value as RoleFilter)}
        className={inputClasses}
      >
        <option value="all">Todos los roles</option>
        <option value="administrator">Administrador</option>
        <option value="manager">Gerente</option>
        <option value="purchasing">Compras</option>
        <option value="staff">Empleado</option>
      </select>

      <select
        value={activeFilter}
        onChange={(event) => onActiveFilterChange(event.target.value as ActiveFilter)}
        className={inputClasses}
      >
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
        <option value="all">Todos</option>
      </select>
    </div>
  )
}
