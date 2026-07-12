export const ROUTES = {
  LOGIN: '/login',
  SET_PASSWORD: '/set-password',
  HOME: '/',
  PRODUCTS: '/products',
  PRODUCT_NEW: '/products/new',
  PRODUCT_EDIT: '/products/:id/edit',
  SUPPLIERS: '/suppliers',
  SUPPLIER_NEW: '/suppliers/new',
  SUPPLIER_EDIT: '/suppliers/:id/edit',
  STORES: '/stores',
  STORE_NEW: '/stores/new',
  STORE_EDIT: '/stores/:id/edit',
  CATEGORIES: '/categories',
  CATEGORY_NEW: '/categories/new',
  CATEGORY_EDIT: '/categories/:id/edit',
  INVENTORY: '/inventory',
  STOCK_COUNTS: '/inventory/counts',
  STOCK_COUNT_DETAIL: '/inventory/counts/:id',
  PURCHASE_SUGGESTIONS: '/purchase-suggestions',
  PURCHASES: '/purchases',
  PURCHASE_NEW: '/purchases/new',
  STORE_TRANSFERS: '/store-transfers',
  PURCHASE_STATISTICS: '/purchase-statistics',
  STAFF: '/staff',
  STAFF_NEW: '/staff/new',
  STAFF_EDIT: '/staff/:id/edit',
} as const

export function productEditRoute(id: string) {
  return `/products/${id}/edit`
}

export function supplierEditRoute(id: string) {
  return `/suppliers/${id}/edit`
}

export function storeEditRoute(id: string) {
  return `/stores/${id}/edit`
}

export function categoryEditRoute(id: string) {
  return `/categories/${id}/edit`
}

export function stockCountDetailRoute(id: string) {
  return `/inventory/counts/${id}`
}

export function staffEditRoute(id: string) {
  return `/staff/${id}/edit`
}
