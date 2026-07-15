import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AppLayout } from '@/app/AppLayout'
import { LoginPage, SetPasswordPage } from '@/features/auth'
import { ProductListPage, ProductFormPage } from '@/features/products'
import { SupplierListPage, SupplierFormPage } from '@/features/suppliers'
import { StoreListPage, StoreFormPage } from '@/features/stores'
import { CategoryListPage, CategoryFormPage } from '@/features/categories'
import { SupplySourceListPage, SupplySourceFormPage } from '@/features/supply-sources'
import { CurrentInventoryPage, StockCountListPage, StockCountDetailPage } from '@/features/inventory'
import {
  StorePurchaseRequestListPage,
  StorePurchaseRequestNewPage,
  StorePurchaseRequestDetailPage,
} from '@/features/store-purchase-requests'
import { ComprasPage, NuevaCompraPage, PurchaseOrderDetailPage } from '@/features/purchasing'
import { StaffListPage, StaffFormPage } from '@/features/staff'
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

          <Route
            path={ROUTES.SET_PASSWORD}
            element={
              <div className="flex min-h-svh items-center justify-center p-4">
                <SetPasswordPage />
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
              <Route path={ROUTES.SUPPLY_SOURCES} element={<SupplySourceListPage />} />
              <Route path={ROUTES.SUPPLY_SOURCE_NEW} element={<SupplySourceFormPage />} />
              <Route path={ROUTES.SUPPLY_SOURCE_EDIT} element={<SupplySourceFormPage />} />
              <Route path={ROUTES.INVENTORY} element={<CurrentInventoryPage />} />
              <Route path={ROUTES.STOCK_COUNTS} element={<StockCountListPage />} />
              <Route path={ROUTES.STOCK_COUNT_DETAIL} element={<StockCountDetailPage />} />
              <Route path={ROUTES.STORE_PURCHASE_REQUESTS} element={<StorePurchaseRequestListPage />} />
              <Route path={ROUTES.STORE_PURCHASE_REQUEST_NEW} element={<StorePurchaseRequestNewPage />} />
              <Route path={ROUTES.STORE_PURCHASE_REQUEST_DETAIL} element={<StorePurchaseRequestDetailPage />} />
              <Route path={ROUTES.PURCHASES} element={<ComprasPage />} />
              <Route path={ROUTES.PURCHASE_NEW} element={<NuevaCompraPage />} />
              <Route path={ROUTES.PURCHASE_DETAIL} element={<PurchaseOrderDetailPage />} />
              <Route path={ROUTES.STAFF} element={<StaffListPage />} />
              <Route path={ROUTES.STAFF_NEW} element={<StaffFormPage />} />
              <Route path={ROUTES.STAFF_EDIT} element={<StaffFormPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
