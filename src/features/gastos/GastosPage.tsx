import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FileImage, Pencil, Plus, Receipt, Trash2, Upload } from 'lucide-react'
import { Button, Card, EmptyState, Field, Modal, Notice, PageHeader, SelectInput, TextInput } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { errorMessage, readTable } from '@/lib/db'
import { formatDate, formatMoney, isoDate, parseDate, type Currency } from '@/lib/format'
import { latestRate, rateAmount } from '@/lib/rates'
import { requireSupabase, supabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

type ExpenseForm = { concepto: string; categoria_id: string; monto_original: string; moneda: Currency; tasa_a_base: string; metodo_pago_id: string; fecha: string }
const blankForm = (): ExpenseForm => ({ concepto: '', categoria_id: '', monto_original: '', moneda: 'COP', tasa_a_base: '1', metodo_pago_id: '', fecha: isoDate() })
const expenseDate = (row: DbRow) => String(row.fecha ?? row.created_at ?? '')
const bucketName = import.meta.env.VITE_SUPABASE_RECEIPTS_BUCKET || 'comprobantes'
const maxReceiptBytes = 5 * 1024 * 1024
const receiptTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
const receiptMime = (file: File) => file.type || receiptTypes[file.name.split('.').pop()?.toLowerCase() ?? ''] || ''
const isReceiptImage = (file: File) => Object.values(receiptTypes).includes(receiptMime(file))

export function GastosPage() {
  const [expenses, setExpenses] = useState<DbRow[]>([])
  const [categories, setCategories] = useState<DbRow[]>([])
  const [methods, setMethods] = useState<DbRow[]>([])
  const [rates, setRates] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DbRow | null>(null)
  const [form, setForm] = useState<ExpenseForm>(blankForm())
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [monthFilter, setMonthFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const { showToast } = useToast()

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const [expenseRows, categoryRows, methodRows, rateRows] = await Promise.all([
        readTable('gastos'), readTable('categorias_gastos'), readTable('metodos_pago'), readTable('tasas_cambio'),
      ])
      setExpenses(expenseRows)
      setCategories(categoryRows)
      setMethods(methodRows.filter((row) => row.activo !== false))
      setRates(rateRows)
    } catch (error) { showToast(errorMessage(error, 'No se pudieron cargar los gastos.'), 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(blankForm())
    setFile(null)
    setModalOpen(true)
  }

  function openEdit(row: DbRow) {
    setEditing(row)
    const rowDate = parseDate(expenseDate(row))
    setForm({ concepto: String(row.concepto ?? ''), categoria_id: String(row.categoria_id ?? ''), monto_original: String(row.monto_original ?? ''), moneda: String(row.moneda ?? 'COP') as Currency, tasa_a_base: String(row.tasa_a_base ?? 1), metodo_pago_id: String(row.metodo_pago_id ?? ''), fecha: Number.isNaN(rowDate.getTime()) ? isoDate() : isoDate(rowDate) })
    setFile(null)
    setModalOpen(true)
  }

  function changeCurrency(next: Currency) {
    setForm((current) => ({ ...current, moneda: next }))
    if (next === 'COP') { setForm((current) => ({ ...current, moneda: next, tasa_a_base: '1' })); return }
    const latest = latestRate(rates, next)
    setForm((current) => ({ ...current, moneda: next, tasa_a_base: String(latest ? rateAmount(latest) : '') }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const conversion = Number(form.tasa_a_base || 0)
    if (form.moneda !== 'COP' && !(conversion > 0)) { showToast('Ingresa una tasa de cambio válida.', 'error'); return }
    if (file && !isReceiptImage(file)) { showToast('Adjunta una imagen JPG, PNG, WebP o GIF.', 'error'); return }
    if (file && file.size > maxReceiptBytes) { showToast('La imagen debe pesar 5 MB o menos.', 'error'); return }
    setBusy(true)
    try {
      const client = requireSupabase()
      let receiptPath = String(editing?.comprobante_url ?? '')
      let uploadedPath = ''
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `gastos/${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`
        const { data, error } = await client.storage.from(bucketName).upload(path, file, { cacheControl: '3600', upsert: false, contentType: receiptMime(file) })
        if (error) throw error
        uploadedPath = data.path
        receiptPath = data.path
      }
      const rate = form.moneda === 'COP' ? 1 : conversion
      const payload = {
        concepto: form.concepto.trim(),
        categoria_id: Number(form.categoria_id),
        monto_original: Number(form.monto_original),
        moneda: form.moneda,
        tasa_a_base: rate,
        monto_en_base: Number(form.monto_original) * rate,
        metodo_pago_id: form.metodo_pago_id ? Number(form.metodo_pago_id) : null,
        fecha: form.fecha,
        comprobante_url: receiptPath || null,
      }
      const result = editing
        ? await client.from('gastos').update(payload).eq('id', editing.id)
        : await client.from('gastos').insert(payload)
      if (result.error) {
        if (uploadedPath) {
          const { error: cleanupError } = await client.storage.from(bucketName).remove([uploadedPath])
          if (cleanupError) showToast('No se pudo guardar el gasto ni limpiar la imagen subida.', 'error')
        }
        throw result.error
      }
      const previousPath = String(editing?.comprobante_url ?? '')
      if (uploadedPath && previousPath && !previousPath.startsWith('http') && previousPath !== uploadedPath) {
        const { error: cleanupError } = await client.storage.from(bucketName).remove([previousPath])
        if (cleanupError) showToast('Gasto guardado, pero no se pudo retirar el comprobante anterior de Storage.', 'error')
      }
      showToast(editing ? 'Gasto actualizado.' : 'Gasto guardado.')
      setModalOpen(false)
      setFile(null)
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo guardar el gasto.'), 'error') }
    finally { setBusy(false) }
  }

  async function remove(row: DbRow) {
    if (!window.confirm(`¿Eliminar el gasto «${String(row.concepto ?? 'sin concepto')}»? Esta acción no se puede deshacer.`)) return
    try {
      const client = requireSupabase()
      const { error } = await client.from('gastos').delete().eq('id', row.id)
      if (error) throw error
      const receiptPath = String(row.comprobante_url ?? '')
      if (receiptPath && !receiptPath.startsWith('http')) {
        const { error: cleanupError } = await client.storage.from(bucketName).remove([receiptPath])
        if (cleanupError) showToast('Gasto eliminado, pero no se pudo retirar el comprobante de Storage.', 'error')
        else showToast('Gasto y comprobante eliminados.')
      } else showToast('Gasto eliminado.')
      await load()
    } catch (error) { showToast(errorMessage(error, 'No se pudo eliminar el gasto.'), 'error') }
  }

  async function openReceipt(row: DbRow) {
    const path = String(row.comprobante_url ?? '')
    if (!path) { showToast('Este gasto no tiene comprobante adjunto.', 'error'); return }
    if (path.startsWith('http')) { window.open(path, '_blank', 'noopener,noreferrer'); return }
    try {
      const { data, error } = await requireSupabase().storage.from(bucketName).createSignedUrl(path, 300)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) { showToast(errorMessage(error, 'No se pudo abrir el comprobante. Revisa el bucket y sus políticas.'), 'error') }
  }

  const categoryType = (row: DbRow) => String(categories.find((category) => String(category.id) === String(row.categoria_id))?.tipo ?? 'operativo').toLowerCase()
  const filtered = useMemo(() => expenses.filter((row) => {
    const date = expenseDate(row)
    return (!monthFilter || date.slice(0, 7) === monthFilter) && (!categoryFilter || String(row.categoria_id) === categoryFilter) && (!typeFilter || categoryType(row) === typeFilter)
  }), [expenses, categories, monthFilter, categoryFilter, typeFilter])
  const operating = filtered.filter((row) => categoryType(row) !== 'activo')
  const assets = filtered.filter((row) => categoryType(row) === 'activo')
  const categoryName = (id: unknown) => String(categories.find((item) => String(item.id) === String(id))?.nombre ?? 'Sin categoría')
  const methodName = (id: unknown) => String(methods.find((item) => String(item.id) === String(id))?.nombre ?? methods.find((item) => String(item.id) === String(id))?.metodo ?? '—')

  function renderGroup(title: string, rows: DbRow[], kind: 'operating' | 'asset') {
    if (typeFilter && ((typeFilter === 'activo' && kind === 'operating') || (typeFilter !== 'activo' && kind === 'asset'))) return null
    return <section className="expense-group" key={kind}><div className="expense-group__heading"><h3>{title}</h3><span>{rows.length} registros</span></div>{rows.length === 0 ? <p className="group-empty">No hay gastos en esta sección con los filtros actuales.</p> : rows.map((row) => <article className="expense-row" key={String(row.id)}>
      <div className="expense-row__mark"><Receipt size={18} /></div>
      <div className="expense-row__main"><strong>{String(row.concepto ?? 'Gasto')}</strong><span>{formatDate(expenseDate(row))} · {categoryName(row.categoria_id)} · {methodName(row.metodo_pago_id)}</span></div>
      <div className="expense-row__amount"><strong>{formatMoney(row.monto_en_base)}</strong><small>{formatMoney(row.monto_original, String(row.moneda ?? 'COP') as Currency)}</small></div>
      <div className="row-actions"><button className="icon-button" onClick={() => void openReceipt(row)} aria-label="Abrir comprobante"><FileImage size={16} /></button><button className="icon-button" onClick={() => openEdit(row)} aria-label="Editar gasto"><Pencil size={16} /></button><button className="icon-button icon-button--danger" onClick={() => void remove(row)} aria-label="Eliminar gasto"><Trash2 size={16} /></button></div>
    </article>)}</section>
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="control de egresos" title="Gastos del negocio" subtitle="Cada compra cuenta: guarda el monto y el comprobante para tener todo claro." action={<Button icon={<Plus size={17} />} onClick={openNew}>Nuevo gasto</Button>} />
      {!supabase && <Notice tone="warning">Conecta Supabase para guardar gastos y comprobantes.</Notice>}
      <Card className="expense-history">
        <div className="table-toolbar table-toolbar--filters"><div><h2>Registro de gastos</h2><p>{filtered.length} registros en la vista</p></div><div className="filter-row"><Field label="Mes"><TextInput type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} /></Field><Field label="Categoría"><SelectInput value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas</option>{categories.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.nombre ?? 'Categoría')}</option>)}</SelectInput></Field><Field label="Tipo"><SelectInput value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos</option><option value="operativo">Operativo</option><option value="servicios">Servicios</option><option value="activo">Activo</option></SelectInput></Field></div></div>
        {loading ? <div className="table-loading">Cargando gastos…</div> : filtered.length === 0 ? <EmptyState title="Aún no hay gastos" description="Registra un gasto para empezar a ordenar los egresos del negocio." action={<Button icon={<Plus size={16} />} onClick={openNew}>Registrar gasto</Button>} /> : <div className="expense-groups">{renderGroup('Operación y servicios', operating, 'operating')}{renderGroup('Activos', assets, 'asset')}</div>}
      </Card>

      {modalOpen && <Modal title={editing ? 'Editar gasto' : 'Nuevo gasto'} description="Guarda el gasto con su moneda original y su valor reportado en COP." onClose={() => setModalOpen(false)} wide>
        <form className="form-grid form-grid--two" onSubmit={save}>
          <Field label="Concepto"><TextInput autoFocus value={form.concepto} onChange={(event) => setForm({ ...form, concepto: event.target.value })} placeholder="Ej. compra de envases" required /></Field>
          <Field label="Categoría"><SelectInput value={form.categoria_id} onChange={(event) => setForm({ ...form, categoria_id: event.target.value })} required><option value="">Selecciona categoría</option>{categories.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.nombre ?? 'Categoría')}</option>)}</SelectInput></Field>
          <Field label="Monto"><TextInput type="number" min="0.01" step="0.01" value={form.monto_original} onChange={(event) => setForm({ ...form, monto_original: event.target.value })} required /></Field>
          <Field label="Moneda"><SelectInput value={form.moneda} onChange={(event) => changeCurrency(event.target.value as Currency)}><option value="COP">COP</option><option value="VES">VES</option><option value="USD">USD</option></SelectInput></Field>
          <Field label="Tasa a COP" hint="Se usa la última tasa guardada cuando está disponible."><TextInput type="number" min="0" step="0.0001" value={form.tasa_a_base} disabled={form.moneda === 'COP'} onChange={(event) => setForm({ ...form, tasa_a_base: event.target.value })} required /></Field>
          <Field label="Método de pago"><SelectInput value={form.metodo_pago_id} onChange={(event) => setForm({ ...form, metodo_pago_id: event.target.value })}><option value="">Sin especificar</option>{methods.map((row) => <option value={String(row.id)} key={String(row.id)}>{String(row.nombre ?? row.metodo ?? 'Método')}</option>)}</SelectInput></Field>
          <Field label="Tipo de gasto" hint="La clasificación se toma de `categorias_gastos.tipo`."><TextInput value={String(categories.find((row) => String(row.id) === form.categoria_id)?.tipo ?? 'elige una categoría')} readOnly /></Field>
          <Field label="Fecha"><TextInput type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} required /></Field>
          <Field label="Comprobante (imagen, máximo 5 MB)" hint="Formatos admitidos: JPG, PNG, WebP y GIF." className="form-grid__full"><div className="upload-control"><Upload size={18} /><span>{file?.name ?? (editing?.comprobante_url ? 'Hay un archivo guardado; puedes reemplazarlo.' : 'Elige una foto del comprobante')}</span><TextInput type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
            const selected = event.target.files?.[0] ?? null
            if (!selected) { setFile(null); return }
            if (!isReceiptImage(selected)) { showToast('Adjunta una imagen JPG, PNG, WebP o GIF.', 'error'); event.target.value = ''; setFile(null); return }
            if (selected.size > maxReceiptBytes) { showToast('La imagen debe pesar 5 MB o menos.', 'error'); event.target.value = ''; setFile(null); return }
            setFile(selected)
          }} /></div></Field>
          <div className="modal__actions form-grid__full"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}>{editing ? 'Guardar cambios' : 'Guardar gasto'}</Button></div>
        </form>
      </Modal>}
    </div>
  )
}
