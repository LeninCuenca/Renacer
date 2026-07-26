import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================
// Tipos
// ============================================================
interface Cliente {
  id: number
  nombre: string
  cedula: string
  telefono?: string | null
  created_at?: string
}

interface Item {
  id?: number
  marca?: string | null
  n_serie?: string | null
  media?: string | null
  diseno?: string | null
  cantidad: number
  valor_unitario: number
  rechazo: boolean
  observaciones: string
  fecha_ingreso?: string | null
}

type EstadoOrden = 'Recepcion' | 'Envio a fabrica' | 'Retorno de fabrica' | 'En bodega' | 'Entregado al cliente'
type TipoPago = 'Contado' | 'Diferido en efectivo' | 'Credito 30 dias' | 'Credito 60 dias' | 'Credito 90 dias' | 'Cheque' | 'Transferencia'

interface Orden {
  id: number
  numero: string
  cliente_id: number
  cliente_nombre?: string | null
  estado: EstadoOrden
  fecha_rc?: string | null
  fecha_ef?: string | null
  fecha_rf?: string | null
  fecha_bodega?: string | null
  fecha_ec?: string | null
  tipo_pago?: string | null
  monto_total: number
  monto_abonado: number
  monto_pendiente: number
  pagado_completo: boolean
  activo_vigente: boolean
  observaciones: string
  created_at?: string | null
  items: Item[]
}

interface ResumenReporte {
  anio: number
  mes: number
  total_ordenes: number
  total_cantidad: number
  promedio_rc_rf_horas: number | null
  promedio_ef_rf_horas: number | null
  promedio_rc_ec_horas: number | null
}

const ESTADOS: EstadoOrden[] = ['Recepcion', 'Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente']
const TIPOS_PAGO: TipoPago[] = ['Contado', 'Diferido en efectivo', 'Credito 30 dias', 'Credito 60 dias', 'Credito 90 dias', 'Cheque', 'Transferencia']

const API_BASE = '/api'

// ============================================================
// API helper
// ============================================================
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { const j = await res.json(); msg = j.detail || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json()
  }
  return undefined as T
}

// ============================================================
// App principal
// ============================================================
type Tab = 'ordenes' | 'nueva' | 'clientes' | 'reporte'

export default function App() {
  const [tab, setTab] = useState<Tab>('ordenes')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-navy-500 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-400 text-lg font-black text-navy-500">R</div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white">Renacer</h1>
            <p className="text-[11px] leading-tight text-navy-100">Registro Operativo</p>
          </div>
          <div className="ml-auto rounded-full bg-primary-400 px-3 py-1 text-xs font-bold text-navy-500">
            {tab === 'ordenes' ? 'Ordenes' : tab === 'nueva' ? 'Nueva Orden' : tab === 'clientes' ? 'Clientes' : 'Reporte'}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-[57px] z-20 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          <TabBtn label="Ordenes" active={tab === 'ordenes'} onClick={() => setTab('ordenes')} />
          <TabBtn label="Nueva" active={tab === 'nueva'} onClick={() => setTab('nueva')} />
          <TabBtn label="Clientes" active={tab === 'clientes'} onClick={() => setTab('clientes')} />
          <TabBtn label="Reporte" active={tab === 'reporte'} onClick={() => setTab('reporte')} />
        </div>
      </nav>

      {/* Contenido */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div key={tab + refreshKey} className="animate-fade-in">
          {tab === 'ordenes' && <OrdenesScreen refreshKey={refreshKey} />}
          {tab === 'nueva' && <NuevaOrdenScreen onCreated={() => { setRefreshKey(k => k + 1); setTab('ordenes') }} />}
          {tab === 'clientes' && <ClientesScreen />}
          {tab === 'reporte' && <ReporteScreen />}
        </div>
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 pt-2 text-center text-xs text-navy-200">
        Renacer · Sistema de registro operativo y control de pagos
      </footer>
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${active ? 'text-navy-500' : 'text-navy-200 hover:text-navy-300'}`}>
      {label}
      {active && <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary-400" />}
    </button>
  )
}

// ============================================================
// Pantalla: Clientes
// ============================================================
function ClientesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await api<Cliente[]>('/clientes')
      setClientes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre.trim() || !cedula.trim()) { setError('Nombre y cedula son obligatorios'); return }
    setSaving(true); setError(null)
    try {
      await api('/clientes', {
        method: 'POST',
        body: JSON.stringify({ nombre, cedula, telefono: telefono || null }),
      })
      setNombre(''); setCedula(''); setTelefono('')
      setShowForm(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingView />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Clientes</h2>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-bold text-navy-500 transition hover:bg-primary-300">
          {showForm ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {showForm && (
        <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-navy-500">Nuevo Cliente</h3>
          <Input label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Juan Perez" />
          <Input label="Cedula *" value={cedula} onChange={setCedula} placeholder="1700000000" />
          <Input label="Telefono" value={telefono} onChange={setTelefono} placeholder="098 765 4321" />
          <button onClick={guardar} disabled={saving}
            className="mt-2 w-full rounded-lg bg-primary-400 px-4 py-3 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      <button onClick={() => { setRefreshing(true); cargar() }}
        className="text-xs font-semibold text-navy-300 hover:text-navy-500">
        {refreshing ? 'Actualizando...' : '↻ Refrescar'}
      </button>

      {clientes.length === 0 ? (
        <EmptyState text="No hay clientes registrados" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clientes.map(c => (
            <div key={c.id} className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-navy-500">{c.nombre}</p>
              <p className="mt-1 text-xs text-navy-300">Cedula: {c.cedula}</p>
              {c.telefono && <p className="text-xs text-navy-300">Tel: {c.telefono}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Pantalla: Nueva Orden
// ============================================================
function NuevaOrdenScreen({ onCreated }: { onCreated: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<number>(0)
  const [numero, setNumero] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<Item[]>([nuevoItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function nuevoItem(): Item {
    return { marca: '', n_serie: '', media: '', diseno: '', cantidad: 1, valor_unitario: 0, rechazo: false, observaciones: '' }
  }

  useEffect(() => {
    api<Cliente[]>('/clientes').then(setClientes).catch(() => {})
  }, [])

  const updateItem = (idx: number, campo: keyof Item, valor: string | boolean | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()])
  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totalEstimado = items.reduce((sum, it) => sum + (it.cantidad * it.valor_unitario), 0)

  const guardar = async () => {
    if (!clienteId || !numero.trim()) { setError('Seleccione cliente e ingrese numero de orden'); return }
    setSaving(true); setError(null)
    try {
      await api('/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          numero, cliente_id: clienteId, observaciones,
          items: items.map(it => ({
            marca: it.marca || null, n_serie: it.n_serie || null,
            media: it.media || null, diseno: it.diseno || null,
            cantidad: it.cantidad, valor_unitario: it.valor_unitario,
            rechazo: it.rechazo, observaciones: it.observaciones,
          })),
        }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear orden')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-navy-500">Nueva Orden de Trabajo</h2>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Datos generales */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-navy-500">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">1</span>
          Datos Generales
        </h3>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Cliente *</label>
          <select value={clienteId} onChange={e => setClienteId(Number(e.target.value))}
            className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
            <option value={0}>Seleccione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.cedula}</option>)}
          </select>
          {clientes.length === 0 && <p className="mt-1.5 text-xs text-orange-600">Primero cree un cliente en la pestana Clientes</p>}
        </div>
        <Input label="Numero de orden *" value={numero} onChange={setNumero} placeholder="OT-0001" />
        <Input label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas..." multiline />
      </section>

      {/* Items dinamicos */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">2</span>
            Items / Llantas
          </h3>
          <button onClick={agregarItem} className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-navy-500 transition hover:bg-primary-100">+ Agregar</button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} className="mb-4 rounded-lg border border-navy-50 bg-[#f8f9fb] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-navy-500">Item #{idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => quitarItem(idx)} className="text-xs font-semibold text-red-500 hover:text-red-700">Quitar</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Marca" value={it.marca || ''} onChange={v => updateItem(idx, 'marca', v)} placeholder="Michelin" />
              <Input label="N° Serie" value={it.n_serie || ''} onChange={v => updateItem(idx, 'n_serie', v)} placeholder="ABC123" />
              <Input label="Media" value={it.media || ''} onChange={v => updateItem(idx, 'media', v)} placeholder="14" />
              <Input label="Diseno" value={it.diseno || ''} onChange={v => updateItem(idx, 'diseno', v)} placeholder="Rayado" />
              <Input label="Cantidad" value={String(it.cantidad)} onChange={v => updateItem(idx, 'cantidad', parseInt(v) || 1)} placeholder="1" type="number" />
              <Input label="Valor unit." value={String(it.valor_unitario)} onChange={v => updateItem(idx, 'valor_unitario', parseFloat(v) || 0)} placeholder="0.00" type="number" />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={it.rechazo} onChange={e => updateItem(idx, 'rechazo', e.target.checked)}
                className="h-4 w-4 rounded border-navy-200 text-primary-400 focus:ring-primary-300" />
              <span className="text-xs font-medium text-navy-400">Rechazo</span>
            </label>
            <Input label="Observaciones del item" value={it.observaciones} onChange={v => updateItem(idx, 'observaciones', v)} placeholder="Notas..." multiline />
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-navy-100 pt-3">
          <span className="text-sm font-semibold text-navy-300">Total estimado:</span>
          <span className="text-lg font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
        </div>
      </section>

      <button onClick={guardar} disabled={saving}
        className="w-full rounded-xl bg-primary-400 px-4 py-3.5 text-sm font-bold text-navy-500 shadow-sm transition hover:bg-primary-300 active:scale-[0.99] disabled:opacity-60">
        {saving ? 'Guardando...' : 'Crear Orden'}
      </button>
    </div>
  )
}

// ============================================================
// Pantalla: Ordenes
// ============================================================
function OrdenesScreen({ refreshKey }: { refreshKey: number }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Orden | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await api<Orden[]>('/ordenes')
      setOrdenes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshKey])

  if (loading) return <LoadingView />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Ordenes de Trabajo</h2>
        <button onClick={() => { setRefreshing(true); cargar() }}
          className="text-xs font-semibold text-navy-300 hover:text-navy-500">
          {refreshing ? 'Actualizando...' : '↻ Refrescar'}
        </button>
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {ordenes.length === 0 ? (
        <EmptyState text="No hay ordenes registradas. Cree una desde la pestana Nueva." />
      ) : (
        <div className="grid gap-3">
          {ordenes.map(o => (
            <button key={o.id} onClick={() => setSelected(o)}
              className="rounded-xl border border-navy-100 bg-white p-4 text-left shadow-sm transition hover:border-primary-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-navy-500">{o.numero}</span>
                <EstadoBadge estado={o.estado} />
              </div>
              <p className="mt-1 text-sm font-semibold text-navy-400">{o.cliente_nombre || 'Cliente'}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-navy-300">
                <span>{o.items.length} items</span>
                <span>Total: ${o.monto_total.toFixed(2)}</span>
                {o.pagado_completo
                  ? <span className="font-bold text-green-600">Pagado</span>
                  : <span className="text-red-500">Pend: ${o.monto_pendiente.toFixed(2)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <OrdenDetalleModal orden={selected} onClose={() => { setSelected(null); cargar() }} />}
    </div>
  )
}

function OrdenDetalleModal({ orden, onClose }: { orden: Orden; onClose: () => void }) {
  const [abonoMonto, setAbonoMonto] = useState('')
  const [tipoPago, setTipoPago] = useState<string>(orden.tipo_pago || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const cambiarEstado = async (estado: EstadoOrden) => {
    try {
      await api(`/ordenes/${orden.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) })
      setMsg(`Estado cambiado a: ${estado}`)
      onClose()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) { setMsg('Ingrese un monto valido'); return }
    setSaving(true)
    try {
      await api(`/ordenes/${orden.id}/abonos`, { method: 'POST', body: JSON.stringify({ monto }) })
      setAbonoMonto('')
      setMsg(`Abono de $${monto.toFixed(2)} registrado`)
      onClose()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const definirPago = async () => {
    if (!tipoPago) return
    try {
      await api(`/ordenes/${orden.id}/pago`, { method: 'POST', body: JSON.stringify({ tipo_pago: tipoPago }) })
      setMsg(`Tipo de pago: ${tipoPago}`)
      onClose()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-navy-500">Orden {orden.numero}</h3>
          <button onClick={onClose} className="text-lg text-navy-200 hover:text-navy-500">✕</button>
        </div>

        {msg && <div className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-navy-500">{msg}</div>}

        <p className="text-sm font-semibold text-navy-400">{orden.cliente_nombre}</p>
        <div className="mt-2"><EstadoBadge estado={orden.estado} /></div>

        {/* Trazabilidad */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Trazabilidad</h4>
        <FechaRow label="Recepcion (RC)" fecha={orden.fecha_rc} />
        <FechaRow label="Envio fabrica (EF)" fecha={orden.fecha_ef} />
        <FechaRow label="Retorno fabrica (RF)" fecha={orden.fecha_rf} />
        <FechaRow label="En bodega" fecha={orden.fecha_bodega} />
        <FechaRow label="Entrega (EC)" fecha={orden.fecha_ec} />

        {/* Cambiar estado */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Cambiar estado operativo</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ESTADOS.map(e => (
            <button key={e} onClick={() => cambiarEstado(e)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                orden.estado === e
                  ? 'border-primary-400 bg-primary-400 text-navy-500'
                  : 'border-navy-100 bg-white text-navy-400 hover:border-primary-200 hover:bg-primary-50'
              }`}>
              {e}
            </button>
          ))}
        </div>

        {/* Items */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Items ({orden.items.length})</h4>
        {orden.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between border-b border-navy-50 py-2">
            <div>
              <span className="text-sm text-navy-500">{it.cantidad}x {it.marca || 'Sin marca'} — {it.diseno || 'N/D'}</span>
              {it.rechazo && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RECHAZO</span>}
            </div>
            <span className="text-sm font-bold text-navy-500">${(it.cantidad * it.valor_unitario).toFixed(2)}</span>
          </div>
        ))}

        {/* Pago */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Control de Pago</h4>
        <div className="rounded-lg bg-navy-50 p-4">
          <PagoRow label="Total" value={orden.monto_total} color="text-navy-500" />
          <PagoRow label="Abonado" value={orden.monto_abonado} color="text-green-600" />
          <PagoRow label="Pendiente" value={orden.monto_pendiente} color="text-red-500" />
        </div>

        {/* Tipo de pago */}
        <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Tipo de pago</label>
        <select value={tipoPago} onChange={e => setTipoPago(e.target.value)}
          className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
          <option value="">Sin definir</option>
          {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={definirPago} className="mt-2 w-full rounded-lg bg-navy-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-600">
          Definir tipo de pago
        </button>

        {/* Abono */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Registrar abono</h4>
        <Input label="Monto del abono" value={abonoMonto} onChange={setAbonoMonto} placeholder="0.00" type="number" />
        <button onClick={registrarAbono} disabled={saving}
          className="mt-2 w-full rounded-lg bg-primary-400 px-4 py-3 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
          {saving ? 'Procesando...' : 'Registrar abono'}
        </button>

        {orden.activo_vigente && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-600">
            ✓ Orden activa / vigente (pagada completa)
          </div>
        )}
      </div>
    </div>
  )
}

function FechaRow({ label, fecha }: { label: string; fecha?: string | null }) {
  const texto = fecha ? new Date(fecha).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—'
  return (
    <div className="flex justify-between border-b border-navy-50 py-1.5">
      <span className="text-xs text-navy-300">{label}</span>
      <span className="text-xs font-medium text-navy-500">{texto}</span>
    </div>
  )
}

function PagoRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-navy-300">{label}:</span>
      <span className={`text-sm font-bold ${color}`}>${value.toFixed(2)}</span>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    'Recepcion': 'bg-navy-50 text-navy-500',
    'Envio a fabrica': 'bg-orange-50 text-orange-600',
    'Retorno de fabrica': 'bg-primary-50 text-navy-500',
    'En bodega': 'bg-navy-50 text-navy-400',
    'Entregado al cliente': 'bg-green-50 text-green-600',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[estado] || 'bg-navy-50 text-navy-300'}`}>{estado}</span>
}

// ============================================================
// Pantalla: Reporte
// ============================================================
function ReporteScreen() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarResumen = async () => {
    setLoading(true); setError(null)
    try {
      const data = await api<ResumenReporte>(`/reportes/resumen?anio=${anio}&mes=${mes}`)
      setResumen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarResumen() }, [])

  const descargarExcel = () => {
    window.open(`${API_BASE}/reportes/mensual?anio=${anio}&mes=${mes}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-navy-500">Reporte Mensual</h2>

      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-navy-500">Seleccionar periodo</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Año</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))}
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none">
              {[hoy.getFullYear(), hoy.getFullYear() - 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Mes</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))}
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
            </select>
          </div>
        </div>
        <button onClick={cargarResumen} disabled={loading}
          className="mt-4 w-full rounded-lg bg-navy-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-600 disabled:opacity-60">
          {loading ? 'Consultando...' : 'Consultar resumen'}
        </button>
      </section>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {resumen && (
        <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-navy-500">Resumen {resumen.mes}/{resumen.anio}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total ordenes" value={String(resumen.total_ordenes)} />
            <StatCard label="Total items" value={String(resumen.total_cantidad)} />
            <StatCard label="Prom. RC→RF" value={resumen.promedio_rc_rf_horas != null ? `${resumen.promedio_rc_rf_horas}h` : '—'} />
            <StatCard label="Prom. EF→RF" value={resumen.promedio_ef_rf_horas != null ? `${resumen.promedio_ef_rf_horas}h` : '—'} />
            <StatCard label="Prom. RC→EC" value={resumen.promedio_rc_ec_horas != null ? `${resumen.promedio_rc_ec_horas}h` : '—'} />
          </div>
        </section>
      )}

      <button onClick={descargarExcel}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-400 px-4 py-3.5 text-sm font-bold text-navy-500 shadow-sm transition hover:bg-primary-300 active:scale-[0.99]">
        <DownloadIcon /> Descargar Excel
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-300">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy-500">{value}</p>
    </div>
  )
}

// ============================================================
// Componentes UI
// ============================================================
function Input({
  label, value, onChange, placeholder, type, multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="min-h-[70px] w-full resize-y rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200" />
      ) : (
        <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200" />
      )}
    </div>
  )
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-400" />
      <p className="mt-3 text-sm text-navy-300">Cargando...</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-100 bg-white py-12 text-center">
      <p className="text-sm text-navy-200">{text}</p>
    </div>
  )
}

function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="animate-fade-in flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm text-red-700">{message}</p>
      <button onClick={onClose} className="ml-2 text-red-400 hover:text-red-600">✕</button>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
