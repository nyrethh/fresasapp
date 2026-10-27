import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Field, Modal, Notice, PageHeader, SelectInput, Table, TextInput } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { errorMessage, readTable } from '@/lib/db'
import { formatMoney, formatNumber, type Currency } from '@/lib/format'
import { latestRate, rateAmount } from '@/lib/rates'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

type SupplyForm = { nombre: string; unidad: string; stock_actual: string; stock_minimo: string; costo_unitario: string; moneda_costo: Currency }
const blankForm: SupplyForm = { nombre: '', unidad: 'unidad', stock_actual: '0', stock_minimo: '0', costo_unitario: '0', moneda_costo: 'COP' }

export function InsumosPage() {
  const [items, setItems] = useState<DbRow[]>([])
  const [rates, setRates] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DbRow | null>(null)
  const [form, setForm] = useState<SupplyForm>(blankForm)
  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const [supplyRows, rateRows] = await Promise.all([readTable('insumos'), readTable('tasas_cambio').catch(() => [] as DbRow[])])
      setItems(supplyRows)
      setRates(rateRows)
    }
    catch (error) { showToast(errorMessage(error, 'No se pudieron cargar los insumos.'), 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(blankForm)
    setModalOpen(true)
  }

  function openEdit(item: DbRow) {
    setEditing(item)
    setForm({ nombre: String(item.nombre ?? ''), unidad: String(item.unidad_medida ?? 'unidad'), stock_actual: String(item.stock_actual ?? 0), stock_minimo: String(item.stock_minimo ?? 0), costo_unitario: String(item.costo_unitario ?? 0), moneda_costo: String(item.moneda_costo ?? 'COP') as Currency })
    setModalOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const costRate = form.moneda_costo === 'COP' ? 1 : Number(rateAmount(latestRate(rates, form.moneda_costo) ?? {}) || 0)
    if (!(costRate > 0)) { showToast('No hay una tasa vigente hacia COP para la moneda del costo.', 'error'); return }
    setBusy(true)
    try {
      const client = requireSupabase()
      const payload = { nombre: form.nombre.trim(), unidad_medida: form.unidad.trim(), stock_actual: Number(form.stock_actual), stock_minimo: Number(form.stock_minimo), costo_unitario: Number(form.costo_unitario), moneda_costo: form.moneda_costo }
      let supplyId: number | string
      let movementFailed = false
      if (editing) {
        const { error } = await client.from('insumos').update(payload).eq('id', editing.id)
        if (error) throw error
        supplyId = editing.id
        const change = payload.stock_actual - Number(editing.stock_actual ?? 0)
        const movementQuantity = Math.abs(change)
        const { error: movementError } = await client.from('movimientos_inventario').insert({ insumo_id: supplyId, tipo_movimiento: change > 0 ? 'entrada' : change < 0 ? 'salida' : 'ajuste', cantidad: movementQuantity, costo_total: movementQuantity * payload.costo_unitario, moneda: form.moneda_costo, tasa_a_cop: costRate, fecha: new Date().toISOString(), motivo: 'edición de insumo' })
        if (movementError) { movementFailed = true; showToast(`Insumo actualizado; no se pudo registrar el movimiento: ${errorMessage(movementError)}`, 'error') }
      } else {
        const { data, error } = await client.from('insumos').insert(payload).select('id').single()
        if (error) throw error
        supplyId = data.id
        const { error: movementError } = await client.from('movimientos_inventario').insert({ insumo_id: supplyId, tipo_movimiento: 'entrada', cantidad: payload.stock_actual, costo_total: payload.stock_actual * payload.costo_unitario, moneda: form.moneda_costo, tasa_a_cop: costRate, fecha: new Date().toISOString(), motivo: 'stock inicial' })
        if (movementError) { movementFailed = true; showToast(`Insumo creado; no se pudo registrar el movimiento: ${errorMessage(movementError)}`, 'error') }
      }
      if (!movementFailed) showToast(editing ? 'Insumo actualizado.' : 'Insumo agregado.')
      setModalOpen(false)
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo guardar el insumo.'), 'error') }
    finally { setBusy(false) }
  }

  async function remove(item: DbRow) {
    if (!window.confirm(`¿Eliminar «${String(item.nombre)}»? Esta acción no se puede deshacer.`)) return
    try {
      const { error } = await requireSupabase().from('insumos').delete().eq('id', item.id)
      if (error) throw error
      showToast('Insumo eliminado.')
      await load()
    } catch (error) {
      const code = (error as { code?: string })?.code
      showToast(code === '23503' ? 'Este insumo tiene movimientos o recetas asociados y no se puede eliminar.' : errorMessage(error, 'No se pudo eliminar el insumo.'), 'error')
    }
  }

  const filtered = items.filter((item) => String(item.nombre ?? '').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  const lowCount = items.filter((item) => Number(item.stock_actual ?? 0) < Number(item.stock_minimo ?? 0)).length

  return (
    <div className="page-stack">
      <PageHeader eyebrow="inventario" title="Tus insumos" subtitle="Ten a la mano lo que necesitas para cada preparación." action={<Button icon={<Plus size={17} />} onClick={openNew}>Nuevo insumo</Button>} />
      {!supabase && <Notice tone="warning">Conecta Supabase para consultar y guardar tu inventario.</Notice>}
      {lowCount > 0 && <Notice tone="warning"><AlertTriangle size={17} /> Hay {lowCount} insumo{lowCount === 1 ? '' : 's'} por debajo del stock mínimo.</Notice>}
      <Card className="table-card">
        <div className="table-toolbar"><div><h2>Inventario actual</h2><p>{items.length} insumos registrados</p></div><div className="search-box"><Search size={17} /><TextInput placeholder="Buscar insumo" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        {loading ? <div className="table-loading">Cargando inventario…</div> : filtered.length === 0 ? <EmptyState title={items.length ? 'No encontramos ese insumo' : 'Tu inventario empieza aquí'} description={items.length ? 'Prueba con otro nombre.' : 'Agrega el primer insumo para llevar control del stock.'} action={!items.length && <Button icon={<Plus size={16} />} onClick={openNew}>Agregar insumo</Button>} /> : (
          <Table><thead><tr><th>Insumo</th><th>Unidad</th><th>Stock actual</th><th>Stock mínimo</th><th>Costo unitario</th><th aria-label="Acciones" /></tr></thead><tbody>
            {filtered.map((item) => {
              const low = Number(item.stock_actual ?? 0) < Number(item.stock_minimo ?? 0)
              return <tr key={String(item.id)} className={low ? 'data-table__row--low' : ''}>
                <td><strong>{String(item.nombre ?? '—')}</strong>{low && <span className="table-subline">necesita reposición</span>}</td>
                <td>{String(item.unidad_medida ?? '—')}</td><td><span className={low ? 'stock-number stock-number--low' : 'stock-number'}>{formatNumber(item.stock_actual)}</span></td><td>{formatNumber(item.stock_minimo)}</td><td>{formatMoney(item.costo_unitario, String(item.moneda_costo ?? 'COP') as Currency)}</td>
                <td><div className="row-actions"><button className="icon-button" onClick={() => openEdit(item)} aria-label={`Editar ${String(item.nombre)}`}><Pencil size={16} /></button><button className="icon-button icon-button--danger" onClick={() => void remove(item)} aria-label={`Eliminar ${String(item.nombre)}`}><Trash2 size={16} /></button></div></td>
              </tr>
            })}
          </tbody></Table>
        )}
      </Card>
      {modalOpen && <Modal title={editing ? 'Editar insumo' : 'Nuevo insumo'} description="Registra existencias y costo para mantener el inventario al día." onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          <Field label="Nombre"><TextInput autoFocus value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} required placeholder="Ej. Fresas frescas" /></Field>
          <Field label="Unidad"><SelectInput value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })}><option value="unidad">Unidad</option><option value="kg">Kilogramo (kg)</option><option value="g">Gramo (g)</option><option value="l">Litro (l)</option><option value="ml">Mililitro (ml)</option><option value="paquete">Paquete</option></SelectInput></Field>
          <div className="form-grid form-grid--two"><Field label="Stock actual"><TextInput type="number" min="0" step="0.01" value={form.stock_actual} onChange={(event) => setForm({ ...form, stock_actual: event.target.value })} required /></Field><Field label="Stock mínimo"><TextInput type="number" min="0" step="0.01" value={form.stock_minimo} onChange={(event) => setForm({ ...form, stock_minimo: event.target.value })} required /></Field></div>
          <Field label="Moneda del costo"><SelectInput value={form.moneda_costo} onChange={(event) => setForm({ ...form, moneda_costo: event.target.value as Currency })}><option value="COP">COP</option><option value="VES">VES</option><option value="USD">USD</option></SelectInput></Field>
          <Field label={`Costo unitario (${form.moneda_costo})`}><TextInput type="number" min="0" step="0.01" value={form.costo_unitario} onChange={(event) => setForm({ ...form, costo_unitario: event.target.value })} required /></Field>
          <div className="modal__actions"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}>{editing ? 'Guardar cambios' : 'Crear insumo'}</Button></div>
        </form>
      </Modal>}
    </div>
  )
}
