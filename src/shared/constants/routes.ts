export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  PRODUCTS: '/products',
  PRODUCT_NEW: '/products/new',
  PRODUCT_EDIT: '/products/:id/edit',
  STOCK_COUNT: '/stock-count',
  PURCHASE_CALCULATION: '/purchase-calculation',
  STORE_TRANSFERS: '/store-transfers',
  PURCHASE_STATISTICS: '/purchase-statistics',
} as const

export function productEditRoute(id: string) {
  return `/products/${id}/edit`
}
