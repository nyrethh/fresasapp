import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Field, Notice, PageHeader, SelectInput, TextInput } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { errorMessage, readTable } from '@/lib/db'
import { formatDate, formatMoney, formatNumber, isoDate, parseDate, type Currency } from '@/lib/format'
import { latestRate, rateAmount } from '@/lib/rates'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

type SaleLine = { producto_id: string; cantidad: string; precio: string; precio_base?: number }
const currencies: Currency[] = ['COP', 'VES', 'USD']
const emptyLine = (): SaleLine => ({ producto_id: '', cantidad: '1', precio: '0' })
const roundPrice = (value: number) => String(Math.round((value + Number.EPSILON) * 100) / 100)
const dateOf = (row: DbRow) => String(row.fecha ?? row.created_at ?? '')

export function VentasPage() {
  const [products, setProducts] = useState<DbRow[]>([])
  const [methods, setMethods] = useState<DbRow[]>([])
  const [rates, setRates] = useState<DbRow[]>([])
  const [sales, setSales] = useState<DbRow[]>([])
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()])
  const [currency, setCurrency] = useState<Currency>('COP')
  const [rate, setRate] = useState('1')
  const [methodId, setMethodId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [expanded, setExpanded] = useState<string | number | null>(null)
  const [details, setDetails] = useState<Record<string, DbRow[]>>({})
  const [editingSale, setEditingSale] = useState<DbRow | null>(null)
  const defaultsLoaded = useRef(false)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const [productRows, methodRows, rateRows, saleRows] = await Promise.all([
        readTable('productos'), readTable('metodos_pago'), readTable('tasas_cambio'), readTable('ventas'),
      ])
      setProducts(productRows)
      setMethods(methodRows.filter((row) => row.activo !== false))
      setRates(rateRows)
      setSales(saleRows)
      if (!defaultsLoaded.current) {
        const firstMethod = methodRows.find((row) => row.activo !== false)
        if (firstMethod) setMethodId(String(firstMethod.id))
        setRate('1')
        defaultsLoaded.current = true
      }
    } catch (error) { showToast(errorMessage(error, 'No se pudieron cargar los datos de ventas.'), 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  const totalOriginal = useMemo(() => lines.reduce((sum, line) => sum + Number(line.cantidad || 0) * Number(line.precio || 0), 0), [lines])
  const exchangeRate = currency === 'COP' ? 1 : Number(rate || 0)
  const totalCOP = totalOriginal * exchangeRate

  function productPriceInCOP(product: DbRow) {
    const amount = Number(product.precio_base ?? product.precio ?? 0)
    const productCurrency = String(product.moneda_precio ?? 'COP').toUpperCase()
    if (productCurrency === 'COP') return amount
    const storedRate = Number(rateAmount(latestRate(rates, productCurrency) ?? {}) || 0)
    return storedRate > 0 ? amount * storedRate : null
  }

  function changeCurrency(next: Currency) {
    const previousRate = exchangeRate
    const latest = latestRate(rates, next)
    const storedRate = rateAmount(latest ?? {})
    const nextRate = next === 'COP' ? 1 : Number(storedRate || 0)
    setCurrency(next)
    setRate(next === 'COP' ? '1' : String(storedRate ?? ''))
    setLines((current) => current.map((line) => {
      if (!line.producto_id) return line
      const priceBase = line.precio_base ?? Number(line.precio || 0) * previousRate
      return { ...line, precio_base: priceBase, precio: nextRate > 0 ? roundPrice(priceBase / nextRate) : '' }
    }))
  }

  function changeRate(value: string) {
    setRate(value)
    const nextRate = currency === 'COP' ? 1 : Number(value || 0)
    setLines((current) => current.map((line) => {
      if (!line.producto_id) return line
      if (!(nextRate > 0)) {
        return { ...line, precio_base: line.precio_base ?? Number(line.precio || 0) * exchangeRate, precio: '' }
      }
      if (line.precio === '' && line.precio_base !== undefined) return { ...line, precio: roundPrice(line.precio_base / nextRate) }
      return { ...line, precio_base: Number(line.precio || 0) * nextRate }
    }))
  }

  function updateLine(index: number, patch: Partial<SaleLine>) {
    const selectedProduct = patch.producto_id ? products.find((item) => String(item.id) === patch.producto_id) : undefined
    const selectedPrice = selectedProduct ? productPriceInCOP(selectedProduct) : 0
    if (selectedPrice === null) { showToast('No hay una tasa hacia COP para la moneda de este producto. Revisa tasas_cambio.', 'error'); return }
    setLines((current) => current.map((line, position) => {
      if (position !== index) return line
      const next = { ...line, ...patch }
      if (patch.producto_id !== undefined) {
        if (!patch.producto_id) { next.precio_base = undefined; next.precio = '0' }
        else {
          next.precio_base = selectedPrice ?? 0
          next.precio = exchangeRate > 0 ? roundPrice((selectedPrice ?? 0) / exchangeRate) : ''
        }
      } else if (patch.precio !== undefined) {
        next.precio_base = Number(patch.precio || 0) * exchangeRate
      }
      return next
    }))
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validLines = lines.filter((line) => line.producto_id && Number.isInteger(Number(line.cantidad)) && Number(line.cantidad) >= 1 && Number(line.precio) >= 0)
    if (!validLines.length) { showToast('Agrega al menos un producto con cantidad entera válida.', 'error'); return }
    if (!methodId) { showToast('Agrega un método de pago en la tabla metodos_pago.', 'error'); return }
    if (currency !== 'COP' && !(exchangeRate > 0)) { showToast('Ingresa una tasa de cambio válida.', 'error'); return }
    setBusy(true)
    try {
      const client = requireSupabase()
      const payload = {
        total_original: totalOriginal,
        moneda_pago: currency,
        tasa_a_base: exchangeRate,
        total_en_base: totalCOP,
        metodo_pago_id: Number(methodId),
        fecha: editingSale ? editingSale.fecha ?? editingSale.created_at ?? new Date().toISOString() : new Date().toISOString(),
      }
      let saleId = editingSale?.id
      if (editingSale) {
        const { error } = await client.from('ventas').update(payload).eq('id', editingSale.id)
        if (error) throw error
        const { error: deleteError } = await client.from('venta_detalles').delete().eq('venta_id', editingSale.id)
        if (deleteError) throw deleteError
      } else {
        const { data: sale, error } = await client.from('ventas').insert(payload).select('id').single()
        if (error) throw error
        saleId = sale.id
      }
      const detailRows = validLines.map((line) => ({
        venta_id: saleId,
        producto_id: Number(line.producto_id),
        cantidad: Number(line.cantidad),
        precio_unitario: Number(line.precio),
        subtotal: Number(line.cantidad) * Number(line.precio),
      }))
      const { error: detailError } = await client.from('venta_detalles').insert(detailRows)
      if (detailError) {
        showToast(`Venta guardada, pero falló el detalle: ${errorMessage(detailError)}`, 'error')
      } else {
        showToast(editingSale ? 'Venta actualizada.' : 'Venta registrada. ¡Buen trabajo!')
      }
      setEditingSale(null)
      setLines([emptyLine()])
      setDetails({})
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo registrar la venta.'), 'error') }
    finally { setBusy(false) }
  }

  async function toggleDetails(sale: DbRow) {
    const id = String(sale.id)
    if (expanded === sale.id) { setExpanded(null); return }
    setExpanded(sale.id)
    if (details[id]) return
    try {
      const { data, error } = await requireSupabase().from('venta_detalles').select('*').eq('venta_id', sale.id)
      if (error) throw error
      setDetails((current) => ({ ...current, [id]: (data ?? []) as DbRow[] }))
    } catch (error) { showToast(errorMessage(error, 'No se pudo cargar el detalle.'), 'error') }
  }

  async function beginEdit(sale: DbRow) {
    const id = String(sale.id)
    let saleLines = details[id]
    if (!saleLines) {
      try {
        const { data, error } = await requireSupabase().from('venta_detalles').select('*').eq('venta_id', sale.id)
        if (error) throw error
        saleLines = (data ?? []) as DbRow[]
        setDetails((current) => ({ ...current, [id]: saleLines ?? [] }))
      } catch (error) { showToast(errorMessage(error, 'No se pudo cargar la venta para editar.'), 'error'); return }
    }
    if (!saleLines.length) { showToast('Esta venta no tiene productos para editar.', 'error'); return }
    setEditingSale(sale)
    const storedCurrency = String(sale.moneda_pago ?? 'COP') as Currency
    const selectedCurrency = currencies.includes(storedCurrency) ? storedCurrency : 'COP'
    const selectedRate = selectedCurrency === 'COP' ? 1 : Number(sale.tasa_a_base ?? 0)
    setLines(saleLines.map((detail) => {
      const price = Number(detail.precio_unitario ?? 0)
      return { producto_id: String(detail.producto_id ?? ''), cantidad: String(detail.cantidad ?? 1), precio: String(price), precio_base: price * selectedRate }
    }))
    setCurrency(selectedCurrency)
    setRate(selectedCurrency === 'COP' ? '1' : String(sale.tasa_a_base ?? ''))
    setMethodId(String(sale.metodo_pago_id ?? ''))
    setExpanded(sale.id)
    document.getElementById('sale-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function removeSale(sale: DbRow) {
    if (!window.confirm(`¿Eliminar la venta #${sale.id} y sus detalles? Esta acción no se puede deshacer.`)) return
    try {
      const client = requireSupabase()
      const { error: detailsError } = await client.from('venta_detalles').delete().eq('venta_id', sale.id)
      if (detailsError) throw detailsError
      const { error } = await client.from('ventas').delete().eq('id', sale.id)
      if (error) throw error
      showToast('Venta eliminada.')
      setDetails((current) => { const next = { ...current }; delete next[String(sale.id)]; return next })
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo eliminar la venta.'), 'error') }
  }

  const filteredSales = sales.filter((sale) => {
    const parsedDate = parseDate(dateOf(sale))
    const date = Number.isNaN(parsedDate.getTime()) ? '' : isoDate(parsedDate)
    return (!dateFilter || date === dateFilter) && (!currencyFilter || String(sale.moneda_pago) === currencyFilter) && (!methodFilter || String(sale.metodo_pago_id) === methodFilter)
  })
  const saleProducts = products.filter((product) => product.activo !== false || (editingSale && lines.some((line) => line.producto_id === String(product.id))))

  return (
    <div className="page-stack">
      <PageHeader eyebrow="movimiento del día" title={editingSale ? 'Actualiza una venta' : 'Registra una venta'} subtitle="Anota cada pedido y mantén tus cifras en una sola moneda base." />
      {!supabase && <Notice tone="warning">Conecta Supabase para guardar ventas y consultar tu catálogo.</Notice>}
      <Card className="sale-form-card">
        <div className="section-heading"><div><h2>{editingSale ? `Editar venta #${editingSale.id}` : 'Nuevo registro'}</h2><p>Agrega los productos del pedido.</p></div><span className="form-step">01 <i>/ venta</i></span></div>
        <form id="sale-entry" onSubmit={saveSale}>
          <div className="sale-lines">
            <div className="sale-line sale-line--head"><span>Producto</span><span>Cantidad</span><span>Precio unitario</span><span>Subtotal</span><span /></div>
            {lines.map((line, index) => (
              <div className="sale-line" key={index}>
                <Field label="Producto" hint={currency !== 'COP' && !(exchangeRate > 0) ? 'Ingresa una tasa para convertir el precio del catálogo.' : 'El precio base se convierte entre la moneda del producto y la venta; puedes editarlo.'}><SelectInput value={line.producto_id} onChange={(event) => updateLine(index, { producto_id: event.target.value })} required disabled={currency !== 'COP' && !(exchangeRate > 0)}><option value="">Selecciona un producto</option>{saleProducts.map((product) => <option value={String(product.id)} key={String(product.id)}>{String(product.nombre ?? 'Producto')}</option>)}</SelectInput></Field>
                <Field label="Cantidad"><TextInput type="number" min="1" step="1" value={line.cantidad} onChange={(event) => updateLine(index, { cantidad: event.target.value })} required /></Field>
                <Field label={`Precio (${currency})`}><TextInput type="number" min="0" step="0.01" value={line.precio} onChange={(event) => updateLine(index, { precio: event.target.value })} required /></Field>
                <div className="sale-line__subtotal"><span className="sale-line__mobile-label">Subtotal</span><strong>{formatMoney(Number(line.cantidad || 0) * Number(line.precio || 0), currency)}</strong></div>
                <button type="button" className="icon-button icon-button--danger" onClick={() => setLines((current) => current.length > 1 ? current.filter((_, row) => row !== index) : [emptyLine()])} aria-label="Quitar producto"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button className="add-line" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}><Plus size={16} /> Agregar otro producto</button>

          <div className="sale-settings">
            <Field label="Método de pago"><SelectInput value={methodId} onChange={(event) => setMethodId(event.target.value)} required><option value="">Selecciona método</option>{methods.map((method) => <option value={String(method.id)} key={String(method.id)}>{String(method.nombre ?? method.metodo ?? `Método ${method.id}`)}</option>)}</SelectInput></Field>
            <Field label="Moneda de pago"><SelectInput value={currency} onChange={(event) => changeCurrency(event.target.value as Currency)}>{currencies.map((code) => <option value={code} key={code}>{code}</option>)}</SelectInput></Field>
            <Field label="Tasa a COP" hint={currency === 'COP' ? 'La moneda base usa tasa 1.' : 'COP por unidad; se sugiere la última guardada. Puedes cambiarla.'}><TextInput type="number" min="0" step="0.0001" value={rate} onChange={(event) => changeRate(event.target.value)} disabled={currency === 'COP'} required /></Field>
          </div>
          <div className="sale-summary"><div><span>Total en {currency}</span><strong>{formatMoney(totalOriginal, currency)}</strong></div><div className="sale-summary__cop"><span>Total reportado en COP</span><strong>{formatMoney(totalCOP)}</strong></div>{editingSale && <Button variant="secondary" type="button" onClick={() => { setEditingSale(null); setLines([emptyLine()]) }}>Cancelar edición</Button>}<Button type="submit" loading={busy}>{editingSale ? 'Guardar cambios' : 'Registrar venta'} <span aria-hidden="true">→</span></Button></div>
        </form>
      </Card>

      <Card className="table-card">
        <div className="table-toolbar table-toolbar--filters"><div><h2>Historial de ventas</h2><p>{filteredSales.length} registros</p></div><div className="filter-row"><Field label="Fecha"><TextInput type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></Field><Field label="Moneda"><SelectInput value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option value="">Todas</option>{currencies.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Método"><SelectInput value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="">Todos</option>{methods.map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.nombre ?? item.metodo ?? item.id)}</option>)}</SelectInput></Field></div></div>
        {loading ? <div className="table-loading">Cargando ventas…</div> : filteredSales.length === 0 ? <EmptyState title="Todavía no hay ventas" description="Cuando registres tu primer pedido, aparecerá aquí con su moneda y detalle." /> : (
          <div className="sales-history">{filteredSales.map((sale) => {
            const saleDetails = details[String(sale.id)] ?? []
            const method = methods.find((item) => String(item.id) === String(sale.metodo_pago_id))
            return <div className="sale-record" key={String(sale.id)}>
              <button className="sale-record__summary" onClick={() => void toggleDetails(sale)} aria-expanded={expanded === sale.id}>
                <span className="sale-record__date">{formatDate(dateOf(sale))}<small>venta #{sale.id}</small></span>
                <span className="sale-record__method">{String(method?.nombre ?? method?.metodo ?? 'Método de pago')}</span>
                <span className="sale-record__currency">{String(sale.moneda_pago ?? 'COP')}</span>
                <strong>{formatMoney(sale.total_en_base, 'COP')}</strong>
                {expanded === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expanded === sale.id && <div className="sale-record__details">
                <div className="sale-record__action-row"><Button variant="secondary" icon={<Pencil size={15} />} onClick={() => void beginEdit(sale)}>Editar venta</Button><Button variant="danger" icon={<Trash2 size={15} />} onClick={() => void removeSale(sale)}>Eliminar</Button></div>
                <div className="sale-record__detail-head"><span>Producto</span><span>Cant.</span><span>Precio</span><span>Subtotal</span></div>
                {saleDetails.length ? saleDetails.map((detail, index) => {
                  const product = products.find((item) => String(item.id) === String(detail.producto_id))
                  return <div className="sale-record__detail-row" key={String(detail.id ?? index)}><span>{String(product?.nombre ?? `Producto #${detail.producto_id ?? '—'}`)}</span><span>{formatNumber(detail.cantidad)}</span><span>{formatMoney(detail.precio_unitario, String(sale.moneda_pago ?? 'COP') as Currency)}</span><strong>{formatMoney(detail.subtotal, String(sale.moneda_pago ?? 'COP') as Currency)}</strong></div>
                }) : <p className="table-subline">No se encontraron líneas de detalle para esta venta.</p>}
                <p className="sale-record__exchange">Original: {formatMoney(sale.total_original, String(sale.moneda_pago ?? 'COP') as Currency)} · tasa guardada: {formatNumber(sale.tasa_a_base)} COP</p>
              </div>}
            </div>
          })}</div>
        )}
      </Card>
    </div>
  )
}
