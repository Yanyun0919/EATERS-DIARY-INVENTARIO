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
  SUPPLY_SOURCES: '/supply-sources',
  SUPPLY_SOURCE_NEW: '/supply-sources/new',
  SUPPLY_SOURCE_EDIT: '/supply-sources/:id/edit',
  INVENTORY: '/inventory',
  STOCK_COUNTS: '/inventory/counts',
  STOCK_COUNT_DETAIL: '/inventory/counts/:id',
  STORE_PURCHASE_REQUESTS: '/store-purchase-requests',
  STORE_PURCHASE_REQUEST_NEW: '/store-purchase-requests/new',
  STORE_PURCHASE_REQUEST_DETAIL: '/store-purchase-requests/:id',
  PURCHASES: '/purchases',
  PURCHASE_NEW: '/purchases/new',
  PURCHASE_DETAIL: '/purchases/:id',
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

export function supplySourceEditRoute(id: string) {
  return `/supply-sources/${id}/edit`
}

export function stockCountDetailRoute(id: string) {
  return `/inventory/counts/${id}`
}

export function staffEditRoute(id: string) {
  return `/staff/${id}/edit`
}

export function purchaseDetailRoute(id: string) {
  return `/purchases/${id}`
}

export function storePurchaseRequestDetailRoute(id: string) {
  return `/store-purchase-requests/${id}`
}
