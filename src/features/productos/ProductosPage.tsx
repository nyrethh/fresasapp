import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Modal, Notice, PageHeader, Table, TextInput } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { errorMessage, readTable } from '@/lib/db'
import { formatMoney, type Currency } from '@/lib/format'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

export function ProductosPage() {
  const [items, setItems] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editingPrice, setEditingPrice] = useState<string | number | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', precio: '' })
  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try { setItems(await readTable('productos')) }
    catch (error) { showToast(errorMessage(error, 'No se pudieron cargar los productos.'), 'error') }
    finally { setLoading(false) }
  }, [showToast])
  useEffect(() => { void load() }, [load])

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const { error } = await requireSupabase().from('productos').insert({ nombre: form.nombre.trim(), precio_base: Number(form.precio), moneda_precio: 'COP', activo: true })
      if (error) throw error
      setModalOpen(false)
      setForm({ nombre: '', precio: '' })
      showToast('Producto creado.')
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo crear el producto.'), 'error') }
    finally { setBusy(false) }
  }

  async function updatePrice(product: DbRow) {
    const price = Number(priceDraft)
    if (!Number.isFinite(price) || price < 0) { showToast('Ingresa un precio válido.', 'error'); return }
    try {
      const { error } = await requireSupabase().from('productos').update({ precio_base: price }).eq('id', product.id)
      if (error) throw error
      setEditingPrice(null)
      showToast('Precio actualizado.')
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo cambiar el precio.'), 'error') }
  }

  async function toggleActive(product: DbRow) {
    const next = product.activo === false
    try {
      const { error } = await requireSupabase().from('productos').update({ activo: next }).eq('id', product.id)
      if (error) throw error
      showToast(next ? 'Producto activado.' : 'Producto pausado.')
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo cambiar el estado.'), 'error') }
  }

  async function remove(product: DbRow) {
    try {
      const client = requireSupabase()
      const { count, error: referenceError } = await client.from('venta_detalles').select('id', { count: 'exact', head: true }).eq('producto_id', product.id)
      if (referenceError) throw referenceError
      if ((count ?? 0) > 0) { showToast('Este producto aparece en el historial de ventas. Desactívalo para conservar esos registros.', 'error'); return }
      if (!window.confirm(`¿Eliminar «${String(product.nombre)}»? Esta acción no se puede deshacer.`)) return
      const { error } = await client.from('productos').delete().eq('id', product.id)
      if (error) throw error
      showToast('Producto eliminado.')
      await load()
    } catch (error) {
      const code = (error as { code?: string })?.code
      showToast(code === '23503' ? 'Este producto está asociado a una receta o registro existente. Desactívalo para conservar el historial.' : errorMessage(error, 'No se pudo eliminar el producto.'), 'error')
    }
  }

  const filtered = items.filter((item) => {
    const nameMatch = String(item.nombre ?? '').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
    const activeMatch = status === '' || (status === 'activo' ? item.activo !== false : item.activo === false)
    return nameMatch && activeMatch
  })

  return (
    <div className="page-stack">
      <PageHeader eyebrow="lo que ofreces" title="Tus productos" subtitle="Actualiza precios y pausa los que no están disponibles." action={<Button icon={<Plus size={17} />} onClick={() => setModalOpen(true)}>Nuevo producto</Button>} />
      {!supabase && <Notice tone="warning">Conecta Supabase para consultar y actualizar tu catálogo.</Notice>}
      <Card className="table-card">
        <div className="table-toolbar table-toolbar--filters"><div><h2>Catálogo</h2><p>{filtered.length} productos en la vista</p></div><div className="filter-row"><div className="search-box"><Search size={17} /><TextInput placeholder="Buscar producto" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Field label="Estado"><select className="input select-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></Field></div></div>
        {loading ? <div className="table-loading">Cargando productos…</div> : filtered.length === 0 ? <EmptyState title={items.length ? 'Sin resultados' : 'Agrega tu primer producto'} description={items.length ? 'Prueba con otra búsqueda o estado.' : 'Empieza con los productos que vendes en tu negocio.'} action={!items.length && <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Crear producto</Button>} /> : (
          <Table><thead><tr><th>Producto</th><th>Precio</th><th>Estado</th><th>Disponible</th><th aria-label="Acciones" /></tr></thead><tbody>{filtered.map((item) => {
            const active = item.activo !== false
            const editing = editingPrice === item.id
            return <tr key={String(item.id)}>
              <td><div className="product-cell">{/* coloca aquí la foto del producto desde public/images/ */}<span className="product-cell__mark">✳</span><span><strong>{String(item.nombre ?? 'Producto')}</strong><small>código #{String(item.id)}</small></span></div></td>
              <td>{editing ? <div className="inline-price"><TextInput type="number" min="0" step="0.01" autoFocus value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void updatePrice(item); if (event.key === 'Escape') setEditingPrice(null) }} /><button className="icon-button icon-button--success" onClick={() => void updatePrice(item)} aria-label="Guardar precio"><Check size={16} /></button><button className="icon-button" onClick={() => setEditingPrice(null)} aria-label="Cancelar edición"><X size={16} /></button></div> : <span className="price-cell">{formatMoney(item.precio_base ?? item.precio, String(item.moneda_precio ?? 'COP') as Currency)}</span>}</td>
              <td><Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activo' : 'Inactivo'}</Badge></td>
              <td><button className={`toggle ${active ? 'toggle--on' : ''}`} role="switch" aria-checked={active} onClick={() => void toggleActive(item)}><span /></button></td>
              <td><div className="row-actions"><button className="icon-button" onClick={() => { setEditingPrice(item.id); setPriceDraft(String(item.precio_base ?? item.precio ?? 0)) }} aria-label={`Editar precio de ${String(item.nombre)}`}><Pencil size={16} /></button><button className="icon-button icon-button--danger" onClick={() => void remove(item)} aria-label={`Eliminar ${String(item.nombre)}`}><Trash2 size={16} /></button></div></td>
            </tr>
          })}</tbody></Table>
        )}
      </Card>
      {modalOpen && <Modal title="Nuevo producto" description="Agrega un producto al catálogo del negocio." onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={saveProduct}><Field label="Nombre"><TextInput autoFocus value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Ej. Fresas con crema" required /></Field><Field label="Precio de venta (COP)"><TextInput type="number" min="0" step="0.01" value={form.precio} onChange={(event) => setForm({ ...form, precio: event.target.value })} required /></Field><div className="modal__actions"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}>Crear producto</Button></div></form>
      </Modal>}
    </div>
  )
}
