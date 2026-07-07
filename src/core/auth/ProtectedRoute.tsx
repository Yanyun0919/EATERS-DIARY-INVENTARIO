import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/core/auth/useAuth'
import { ROUTES } from '@/shared/constants/routes'
import { LoadingScreen } from '@/shared/components/LoadingScreen'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  return <Outlet />
}
