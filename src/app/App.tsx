import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AppLayout } from '@/app/AppLayout'
import { LoginPage } from '@/features/auth'
import { ProductListPage, ProductFormPage } from '@/features/products'
import { SupplierListPage, SupplierFormPage } from '@/features/suppliers'
import { StoreListPage, StoreFormPage } from '@/features/stores'
import { CategoryListPage, CategoryFormPage } from '@/features/categories'
import { CurrentInventoryPage, StockCountListPage, StockCountDetailPage } from '@/features/inventory'
import { PurchaseSuggestionsPage } from '@/features/purchase-suggestions'
import { ROUTES } from '@/shared/constants/routes'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={
              <div className="flex min-h-svh items-center justify-center p-4">
                <LoginPage />
              </div>
            }
          />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.PRODUCTS} replace />} />
              <Route path={ROUTES.PRODUCTS} element={<ProductListPage />} />
              <Route path={ROUTES.PRODUCT_NEW} element={<ProductFormPage />} />
              <Route path={ROUTES.PRODUCT_EDIT} element={<ProductFormPage />} />
              <Route path={ROUTES.SUPPLIERS} element={<SupplierListPage />} />
              <Route path={ROUTES.SUPPLIER_NEW} element={<SupplierFormPage />} />
              <Route path={ROUTES.SUPPLIER_EDIT} element={<SupplierFormPage />} />
              <Route path={ROUTES.STORES} element={<StoreListPage />} />
              <Route path={ROUTES.STORE_NEW} element={<StoreFormPage />} />
              <Route path={ROUTES.STORE_EDIT} element={<StoreFormPage />} />
              <Route path={ROUTES.CATEGORIES} element={<CategoryListPage />} />
              <Route path={ROUTES.CATEGORY_NEW} element={<CategoryFormPage />} />
              <Route path={ROUTES.CATEGORY_EDIT} element={<CategoryFormPage />} />
              <Route path={ROUTES.INVENTORY} element={<CurrentInventoryPage />} />
              <Route path={ROUTES.STOCK_COUNTS} element={<StockCountListPage />} />
              <Route path={ROUTES.STOCK_COUNT_DETAIL} element={<StockCountDetailPage />} />
              <Route path={ROUTES.PURCHASE_SUGGESTIONS} element={<PurchaseSuggestionsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
