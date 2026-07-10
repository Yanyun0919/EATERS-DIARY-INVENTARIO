export const ROUTES = {
  LOGIN: '/login',
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
  STOCK_COUNT: '/stock-count',
  PURCHASE_CALCULATION: '/purchase-calculation',
  STORE_TRANSFERS: '/store-transfers',
  PURCHASE_STATISTICS: '/purchase-statistics',
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
