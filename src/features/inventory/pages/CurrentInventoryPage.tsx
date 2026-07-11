import { useMemo, useState } from 'react'
import { useStaffProfile } from '@/core/auth/useStaffProfile'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { useStores } from '@/features/stores/hooks/useStores'
import { useMyStore } from '@/features/stores/hooks/useStoreAccounts'
import { useStockTrackedProducts, useInventoryForStore } from '@/features/inventory/hooks/useInventory'
import { useAllCategories, useCategories, useUnits } from '@/features/products/hooks/useProductLookups'
import { InventoryFilters } from '@/features/inventory/components/InventoryFilters'
import { InventoryTable } from '@/features/inventory/components/InventoryTable'
import type { Database } from '@/core/supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Inventory = Database['public']['Tables']['inventory']['Row']

const selectClasses =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent'

// Same "is this row low stock" check InventoryTable uses for the badge — kept here too so
// sorting and badge rendering never disagree with each other.
function isLowStock(product: Product, inventoryByProductId: Map<string, Inventory>) {
  const inventory = inventoryByProductId.get(product.id)
  return inventory !== undefined && Number(inventory.quantity_on_hand) < Number(product.minimum_stock)
}

export function CurrentInventoryPage() {
  const { profile, isAdministrator, loading: profileLoading } = useStaffProfile()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const debouncedSearch = useDebouncedValue(search)

  const { data: allStores } = useStores({ isActive: true })
  const { data: myStore, loading: myStoreLoading } = useMyStore(profile?.id ?? null)

  const activeStoreId = isAdministrator ? selectedStoreId || null : (myStore?.id ?? null)

  const { data: products, loading: productsLoading, error: productsError } = useStockTrackedProducts()
  const {
    data: inventoryRows,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventoryForStore(activeStoreId)
  const { data: allCategories } = useAllCategories()
  const { data: filterCategories } = useCategories()
  const { data: units } = useUnits()

  const categoriesById = useMemo(() => new Map((allCategories ?? []).map((category) => [category.id, category])), [allCategories])
  const unitsById = useMemo(() => new Map((units ?? []).map((unit) => [unit.id, unit])), [units])
  const inventoryByProductId = useMemo(
    () => new Map((inventoryRows ?? []).map((row) => [row.product_id, row])),
    [inventoryRows],
  )

  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    const matches = (products ?? []).filter((product) => {
      if (categoryId && product.category_id !== categoryId) return false
      if (term && !product.name.toLowerCase().includes(term)) return false
      return true
    })

    // Stock Bajo first, then Category Order, then Product Name — same priority as the Stock
    // Count list, kept consistent whether or not a search/category filter is applied.
    return [...matches].sort((a, b) => {
      const aLow = isLowStock(a, inventoryByProductId)
      const bLow = isLowStock(b, inventoryByProductId)
      if (aLow !== bLow) return aLow ? -1 : 1

      const aSortOrder = categoriesById.get(a.category_id)?.sort_order ?? 0
      const bSortOrder = categoriesById.get(b.category_id)?.sort_order ?? 0
      if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder

      return a.name.localeCompare(b.name)
    })
  }, [products, categoryId, debouncedSearch, inventoryByProductId, categoriesById])

  const loading = profileLoading || myStoreLoading || productsLoading || inventoryLoading
  const error = productsError ?? inventoryError

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Inventario</h1>

      {isAdministrator ? (
        <div className="flex items-center gap-2">
          <label htmlFor="store" className="text-sm font-medium">
            Tienda
          </label>
          <select
            id="store"
            value={selectedStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            className={selectClasses}
          >
            <option value="">Selecciona una tienda</option>
            {(allStores ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        !myStoreLoading &&
        !myStore && <p className="text-sm text-red-600">No tienes ninguna tienda asignada.</p>
      )}

      {activeStoreId && (
        <>
          <InventoryFilters
            search={search}
            onSearchChange={setSearch}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            categories={filterCategories ?? []}
          />

          {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
          {error && <p className="text-sm text-red-600">{error.message}</p>}

          {!loading && !error && (
            <InventoryTable
              products={filteredProducts}
              categoriesById={categoriesById}
              unitsById={unitsById}
              inventoryByProductId={inventoryByProductId}
            />
          )}
        </>
      )}

      {isAdministrator && !activeStoreId && (
        <p className="text-sm text-neutral-500">Selecciona una tienda para ver su inventario.</p>
      )}
    </div>
  )
}
