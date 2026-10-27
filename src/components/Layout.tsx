import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChartNoAxesCombined, CircleDollarSign, LayoutDashboard, LogOut, Package, ShoppingBasket, Wallet } from 'lucide-react'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/app/AuthProvider'
import { useToast } from '@/components/ToastProvider'

const sections = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/ventas', label: 'Ventas', icon: CircleDollarSign },
  { to: '/insumos', label: 'Insumos', icon: Package },
  { to: '/gastos', label: 'Gastos', icon: Wallet },
  { to: '/productos', label: 'Productos', icon: ShoppingBasket },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Resumen del negocio',
  '/ventas': 'Ventas',
  '/insumos': 'Insumos',
  '/gastos': 'Gastos',
  '/productos': 'Productos',
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  async function handleLogout() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      showToast('No se pudo cerrar la sesión. Inténtalo de nuevo.', 'error')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand"><Brand /></div>
        <p className="nav-label">tu espacio</p>
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {sections.map(({ to, label, icon: Icon }) => (
            <NavLink to={to} key={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
              {to === '/dashboard' && <span className="nav-link__dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <div className="sidebar__note"><ChartNoAxesCombined size={17} /><span>Pequeños pasos,<br />grandes resultados.</span></div>
          <div className="sidebar__user">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div className="sidebar__user-text"><strong>Fruity Fresh</strong><span>administración</span></div>
            <button className="icon-button logout-icon" onClick={handleLogout} aria-label="Cerrar sesión"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__mobile-brand"><Brand compact /></div>
          <div className="topbar__title"><span>Fresas & Crema</span><b>/</b>{pageTitles[location.pathname] ?? 'Gestión'}</div>
          <button className="topbar__logout" onClick={handleLogout}><LogOut size={16} /><span>Salir</span></button>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        {sections.map(({ to, label, icon: Icon }) => (
          <NavLink to={to} key={to} className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
            <Icon size={20} strokeWidth={1.8} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
