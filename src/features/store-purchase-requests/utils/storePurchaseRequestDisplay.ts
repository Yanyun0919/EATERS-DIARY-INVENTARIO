import type { Database } from '@/core/supabase/database.types'

type Category = Database['public']['Tables']['categories']['Row']

export function formatStorePurchaseRequestDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES')
}

// The project's standard product ordering (BUSINESS_RULES.md #4: Category Order, then Product
// Name) -- no persisted display_order (approved Technical Design); always computed live.
export function categoryOrderThenName(
  categoriesById: Map<string, Category>,
  categoryIdA: string,
  nameA: string,
  categoryIdB: string,
  nameB: string,
) {
  const orderA = categoriesById.get(categoryIdA)?.sort_order ?? 0
  const orderB = categoriesById.get(categoryIdB)?.sort_order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return nameA.localeCompare(nameB)
}
