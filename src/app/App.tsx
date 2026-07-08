import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AppLayout } from '@/app/AppLayout'
import { LoginPage } from '@/features/auth'
import { ProductListPage, ProductFormPage } from '@/features/products'
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
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
