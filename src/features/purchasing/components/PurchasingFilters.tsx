import type { Database } from '@/core/supabase/database.types'

type Store = Database['public']['Tables']['stores']['Row']
type Supplier = Database['public']['Tables']['suppliers']['Row']

interface PurchasingFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  storeId: string
  onStoreChange: (value: string) => void
  stores: Store[]
  supplierId: string
  onSupplierChange: (value: string) => void
  suppliers: Supplier[]
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

const inputClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

export function PurchasingFilters({
  search,
  onSearchChange,
  storeId,
  onStoreChange,
  stores,
  supplierId,
  onSupplierChange,
  suppliers,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: PurchasingFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Buscar por proveedor, producto o notas…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className={`${inputClasses} w-72`}
      />

      <select value={storeId} onChange={(event) => onStoreChange(event.target.value)} className={inputClasses}>
        <option value="">Todas las tiendas</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>

      <select value={supplierId} onChange={(event) => onSupplierChange(event.target.value)} className={inputClasses}>
        <option value="">Todos los proveedores</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <label htmlFor="dateFrom" className="text-sm text-neutral-500">
          Desde
        </label>
        <input
          id="dateFrom"
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className={inputClasses}
        />
      </div>

      <div className="flex items-center gap-1">
        <label htmlFor="dateTo" className="text-sm text-neutral-500">
          Hasta
        </label>
        <input
          id="dateTo"
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className={inputClasses}
        />
      </div>
    </div>
  )
}
