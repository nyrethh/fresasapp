import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Package, Plus, ShoppingBag, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Badge, Card, EmptyState, Notice, PageHeader, Skeleton } from '@/components/ui'
import { formatDate, formatMoney, isoDate, parseDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

const asAmount = (row: DbRow, key: string) => Number(row[key] ?? 0) || 0
const asDate = (row: DbRow) => {
  const date = parseDate(String(row.fecha ?? row.created_at ?? ''))
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

export function DashboardPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<DbRow[]>([])
  const [expenses, setExpenses] = useState<DbRow[]>([])
  const [supplies, setSupplies] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const today = isoDate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'equipo').split(' ')[0]

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setLoading(false); return }
      try {
        const [salesResult, expenseResult, supplyResult] = await Promise.all([
          supabase.from('ventas').select('*'),
          supabase.from('gastos').select('*'),
          supabase.from('insumos').select('*'),
        ])
        if (!active) return
        const error = salesResult.error || expenseResult.error || supplyResult.error
        if (error) setConnectionError('No se pudieron cargar todos los datos. Verifica los nombres de las tablas y las políticas RLS en Supabase.')
        setSales((salesResult.data ?? []) as DbRow[])
        setExpenses((expenseResult.data ?? []) as DbRow[])
        setSupplies((supplyResult.data ?? []) as DbRow[])
      } catch {
        if (active) setConnectionError('No se pudo conectar con Supabase. Revisa la conexión y vuelve a cargar la página.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const isSameDay = (row: DbRow) => isoDate(asDate(row)) === today
    const currentMonthSales = sales.filter((row) => asDate(row) >= monthStart)
    const todaySales = sales.filter(isSameDay)
    const monthExpenses = expenses.filter((row) => asDate(row) >= monthStart)
    const revenueToday = todaySales.reduce((sum, row) => sum + asAmount(row, 'total_en_base'), 0)
    const revenueMonth = currentMonthSales.reduce((sum, row) => sum + asAmount(row, 'total_en_base'), 0)
    const expenseMonth = monthExpenses.reduce((sum, row) => sum + asAmount(row, 'monto_en_base'), 0)
    const lowStock = supplies.filter((row) => asAmount(row, 'stock_actual') < asAmount(row, 'stock_minimo'))
    const chart = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const dayKey = isoDate(date)
      const total = sales.filter((row) => isoDate(asDate(row)) === dayKey).reduce((sum, row) => sum + asAmount(row, 'total_en_base'), 0)
      return { label: new Intl.DateTimeFormat('es-VE', { weekday: 'short' }).format(date).replace('.', ''), monto: total }
    })
    return { revenueToday, revenueMonth, expenseMonth, utility: revenueMonth - expenseMonth, lowStock, chart }
  }, [expenses, sales, supplies, today])

  const statsCards = [
    { label: 'Ventas de hoy', value: formatMoney(stats.revenueToday), detail: formatDate(new Date()), icon: CircleDollarSign, tone: 'red' },
    { label: 'Ventas del mes', value: formatMoney(stats.revenueMonth), detail: 'acumulado en COP', icon: ShoppingBag, tone: 'pink' },
    { label: 'Gastos del mes', value: formatMoney(stats.expenseMonth), detail: 'acumulado en COP', icon: Wallet, tone: 'brown' },
    { label: 'Utilidad neta', value: formatMoney(stats.utility), detail: 'ventas menos gastos', icon: ArrowUpRight, tone: 'olive' },
  ]

  return (
    <div className="page-stack">
      <PageHeader eyebrow="tu negocio, en un vistazo" title={`${greeting}, ${firstName}`} subtitle="Así va tu negocio hoy. Aquí tienes un resumen para empezar." action={<Link className="button button--primary" to="/ventas"><Plus size={17} /><span>Nueva venta</span></Link>} />
      {!supabase && <Notice tone="warning">Conecta Supabase con las variables de entorno para cargar cifras reales. No se muestran datos de ejemplo.</Notice>}
      {connectionError && <Notice tone="warning">{connectionError}</Notice>}

      <div className="stats-grid">
        {statsCards.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card className="stat-card" key={label}>
            <div className="stat-card__top"><span>{label}</span><span className={`stat-card__icon stat-card__icon--${tone}`}><Icon size={18} /></span></div>
            {loading ? <Skeleton className="stat-card__skeleton" /> : <strong className="stat-card__value">{value}</strong>}
            <span className="stat-card__detail">{detail}</span>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card className="chart-card">
          <div className="section-heading"><div><h2>Ritmo de ventas</h2><p>Últimos 7 días · montos en COP</p></div><Badge tone="pink">esta semana</Badge></div>
          {loading ? <Skeleton className="chart-skeleton" /> : sales.length === 0 ? <EmptyState title="Aún no hay ventas" description="Cuando registres ventas, aquí verás cómo se mueve tu semana." /> : (
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.chart} margin={{ top: 12, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#f0e6de" strokeDasharray="3 4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#93827b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#93827b', fontSize: 10 }} tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} />
              <Tooltip formatter={(value) => [formatMoney(Number(value)), 'Ventas']} contentStyle={{ borderRadius: 12, border: '1px solid #f1e5dc', boxShadow: '0 8px 24px #3a180f12' }} />
              <Bar dataKey="monto" fill="#ab1816" radius={[7, 7, 2, 2]} maxBarSize={34} />
            </BarChart></ResponsiveContainer></div>
          )}
        </Card>

        <Card className="stock-card">
          <div className="section-heading"><div><h2>Ojo con el inventario</h2><p>Insumos que necesitan atención</p></div><span className="stock-card__symbol"><Package size={19} /></span></div>
          {loading ? <div className="stock-skeletons"><Skeleton /><Skeleton /><Skeleton /></div> : stats.lowStock.length === 0 ? <EmptyState title="Todo en orden" description="No hay insumos por debajo del mínimo." /> : (
            <div className="low-stock-list">
              {stats.lowStock.slice(0, 4).map((item) => (
                <div className="low-stock-item" key={String(item.id)}><span className="low-stock-item__mark"><Package size={16} /></span><span className="low-stock-item__name">{String(item.nombre ?? 'Insumo')}</span><Badge tone="danger">{asAmount(item, 'stock_actual')} / {asAmount(item, 'stock_minimo')}</Badge></div>
              ))}
              <Link className="text-link" to="/insumos">Ver todos los insumos <ArrowDownRight size={15} /></Link>
            </div>
          )}
        </Card>
      </div>

      <div className="quick-actions">
        <div><span className="eyebrow">a mano</span><h2>¿Qué quieres registrar?</h2></div>
        <Link to="/ventas" className="quick-action"><span className="quick-action__icon quick-action__icon--red"><ShoppingBag size={18} /></span><span><strong>Nueva venta</strong><small>Registra una venta del día</small></span><span className="quick-action__arrow">↗</span></Link>
        <Link to="/gastos" className="quick-action"><span className="quick-action__icon quick-action__icon--cream"><Wallet size={18} /></span><span><strong>Nuevo gasto</strong><small>Guarda un pago o compra</small></span><span className="quick-action__arrow">↗</span></Link>
        <Link to="/insumos" className="quick-action"><span className="quick-action__icon quick-action__icon--pink"><Package size={18} /></span><span><strong>Nuevo insumo</strong><small>Actualiza tu inventario</small></span><span className="quick-action__arrow">↗</span></Link>
      </div>
    </div>
  )
}
