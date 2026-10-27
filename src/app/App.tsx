import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { AppLayout } from '@/components/Layout'
import { PageLoader } from '@/components/ui'

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const InsumosPage = lazy(() => import('@/features/insumos/InsumosPage').then((module) => ({ default: module.InsumosPage })))
const VentasPage = lazy(() => import('@/features/ventas/VentasPage').then((module) => ({ default: module.VentasPage })))
const GastosPage = lazy(() => import('@/features/gastos/GastosPage').then((module) => ({ default: module.GastosPage })))
const ProductosPage = lazy(() => import('@/features/productos/ProductosPage').then((module) => ({ default: module.ProductosPage })))

export function App() {
  return (
    <Suspense fallback={<PageLoader label="Preparando el panel…" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/insumos" element={<InsumosPage />} />
            <Route path="/ventas" element={<VentasPage />} />
            <Route path="/gastos" element={<GastosPage />} />
            <Route path="/productos" element={<ProductosPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
