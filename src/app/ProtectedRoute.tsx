import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { PageLoader } from '@/components/ui'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Verificando sesión…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
