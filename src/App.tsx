import { useState, useEffect, useCallback, useRef } from 'react'
import type { Cliente, Orden, Item, EstadoOrden, TipoPago, ResumenReporte } from './types'
import { ESTADOS, TIPOS_PAGO, DIRECCIONES, MEDIDAS_LLANTAS, diasDeCredito, calcularFechaVencimiento, esFeriado, esFinDeSemana } from './types'
import { mockApi } from './mockApi'

// ============================================================
// App principal
// ============================================================
type Tab = 'ordenes' | 'nueva' | 'clientes' | 'reporte'

export default function App() {
  const [tab, setTab] = useState<Tab>('ordenes')
  const [refreshKey, setRefreshKey] = useState(0)
  const [alertasCount, setAlertasCount] = useState(0)

  useEffect(() => {
    mockApi.getCreditosPorVencer().then(alertas => {
      setAlertasCount(alertas.filter(a => a.porVencer || a.vencido).length)
    }).catch(() => {})
  }, [refreshKey])

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-navy-500 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-400 text-lg font-black text-navy-500">R</div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white">Renacer</h1>
            <p className="text-[11px] leading-tight text-navy-100">Registro Operativo</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {alertasCount > 0 && (
              <button onClick={() => setTab('ordenes')}
                className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white animate-pulse">
                <BellIcon /> {alertasCount}
              </button>
            )}
            <div className="rounded-full bg-primary-400 px-3 py-1 text-xs font-bold text-navy-500">
              {tab === 'ordenes' ? 'Ordenes' : tab === 'nueva' ? 'Nueva' : tab === 'clientes' ? 'Clientes' : 'Reporte'}
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-[57px] z-20 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          <TabBtn label="Ordenes" active={tab === 'ordenes'} onClick={() => setTab('ordenes')} />
          <TabBtn label="Nueva" active={tab === 'nueva'} onClick={() => setTab('nueva')} />
          <TabBtn label="Clientes" active={tab === 'clientes'} onClick={() => setTab('clientes')} />
          <TabBtn label="Reporte" active={tab === 'reporte'} onClick={() => setTab('reporte')} />
        </div>
      </nav>

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
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroDir, setFiltroDir] = useState<string>('')

  const cargar = useCallback(async () => {
    try {
      const data = await mockApi.getClientes()
      setClientes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre.trim() || !cedula.trim()) { setError('Nombre y cedula son obligatorios'); return }
    setSaving(true); setError(null)
    try {
      await mockApi.createCliente({ nombre, cedula, telefono: telefono || null, direccion: direccion || null })
      setNombre(''); setCedula(''); setTelefono(''); setDireccion('')
      setShowForm(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const clientesFiltrados = filtroDir ? clientes.filter(c => c.direccion === filtroDir) : clientes
  const conteoDir = DIRECCIONES.map(d => ({ direccion: d, count: clientes.filter(c => c.direccion === d).length })).filter(d => d.count > 0)

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
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Direccion</label>
            <select value={direccion} onChange={e => setDireccion(e.target.value)}
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
              <option value="">Seleccione...</option>
              {DIRECCIONES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={guardar} disabled={saving}
            className="mt-2 w-full rounded-lg bg-primary-400 px-4 py-3 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {conteoDir.length > 0 && (
        <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-600">Conteo por direccion</h3>
          <div className="flex flex-wrap gap-2">
            {conteoDir.map(d => (
              <button key={d.direccion} onClick={() => setFiltroDir(filtroDir === d.direccion ? '' : d.direccion)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filtroDir === d.direccion ? 'bg-primary-400 text-navy-500' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
                {d.direccion} ({d.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {filtroDir && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-navy-400">Filtrando por:</span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 font-bold text-navy-500">{filtroDir}</span>
          <button onClick={() => setFiltroDir('')} className="text-navy-200 hover:text-red-500">✕ quitar</button>
        </div>
      )}

      {clientesFiltrados.length === 0 ? (
        <EmptyState text="No hay clientes registrados" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clientesFiltrados.map(c => (
            <div key={c.id} className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-navy-500">{c.nombre}</p>
              <p className="mt-1 text-xs text-navy-300">Cedula: {c.cedula}</p>
              {c.telefono && <p className="text-xs text-navy-300">Tel: {c.telefono}</p>}
              {c.direccion && <p className="mt-1.5 inline-block rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-400">{c.direccion}</p>}
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

  useEffect(() => { mockApi.getClientes().then(setClientes).catch(() => {}) }, [])

  const updateItem = (idx: number, campo: keyof Item, valor: string | boolean | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()])
  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totalEstimado = items.filter(it => !it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)
  const totalRechazado = items.filter(it => it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)

  const guardar = async () => {
    if (!clienteId || !numero.trim()) { setError('Seleccione cliente e ingrese numero de orden'); return }
    setSaving(true); setError(null)
    try {
      await mockApi.createOrden({
        numero, cliente_id: clienteId, observaciones,
        items: items.map(it => ({
          marca: it.marca || null, n_serie: it.n_serie || null,
          media: it.media || null, diseno: it.diseno || null,
          cantidad: it.cantidad, valor_unitario: it.valor_unitario,
          rechazo: it.rechazo, observaciones: it.observaciones,
        })),
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
        </div>
        <Input label="Numero de orden *" value={numero} onChange={setNumero} placeholder="OT-0001" />
        <Input label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas..." multiline />
      </section>

      {/* Items — una tarjeta por llanta */}
      <section className="rounded-xl border border-navy-100 bg-white shadow-sm">
        {/* Cabecera de la sección */}
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">2</span>
            Items / Llantas
            <span className="ml-1 rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-400">{items.length}</span>
          </h3>
          <button onClick={agregarItem}
            className="flex items-center gap-1.5 rounded-lg bg-navy-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-navy-600 active:scale-95">
            <span className="text-base leading-none">+</span> Agregar llanta
          </button>
        </div>

        {/* Lista de tarjetas */}
        <div className="divide-y divide-navy-50">
          {items.map((it, idx) => {
            const subtotal = it.cantidad * it.valor_unitario
            return (
              <div key={idx} className={`px-5 py-4 transition-colors ${it.rechazo ? 'bg-red-50/60' : 'bg-white'}`}>
                {/* Fila superior: numero de item, subtotal, botón eliminar */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 text-xs font-extrabold text-navy-500">
                      {idx + 1}
                    </span>
                    {it.rechazo && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                        Rechazada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-base font-extrabold ${it.rechazo ? 'text-red-300 line-through' : 'text-navy-500'}`}>
                      ${subtotal.toFixed(2)}
                    </span>
                    {items.length > 1 && (
                      <button onClick={() => quitarItem(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-navy-200 transition hover:bg-red-50 hover:text-red-500">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>

                {/* Fila 1: Marca + N° Serie */}
                <div className="mb-2.5 grid grid-cols-2 gap-2">
                  <ItemField label="Marca">
                    <input value={it.marca || ''} onChange={e => updateItem(idx, 'marca', e.target.value)}
                      placeholder="Ej: Michelin"
                      className="item-input" />
                  </ItemField>
                  <ItemField label="N° Serie">
                    <input value={it.n_serie || ''} onChange={e => updateItem(idx, 'n_serie', e.target.value)}
                      placeholder="Ej: SN-0001"
                      className="item-input" />
                  </ItemField>
                </div>

                {/* Fila 2: Medida + Diseño */}
                <div className="mb-2.5 grid grid-cols-2 gap-2">
                  <ItemField label="Medida">
                    <select value={it.media || ''} onChange={e => updateItem(idx, 'media', e.target.value)}
                      className="item-input">
                      <option value="">Seleccionar...</option>
                      {MEDIDAS_LLANTAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </ItemField>
                  <ItemField label="Diseño">
                    <input value={it.diseno || ''} onChange={e => updateItem(idx, 'diseno', e.target.value)}
                      placeholder="Ej: Rayado"
                      className="item-input" />
                  </ItemField>
                </div>

                {/* Fila 3: Cantidad + Valor unitario */}
                <div className="mb-2.5 grid grid-cols-2 gap-2">
                  <ItemField label="Cantidad">
                    <input type="number" min="1" value={String(it.cantidad)}
                      onChange={e => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                      className="item-input" />
                  </ItemField>
                  <ItemField label="Valor unitario ($)">
                    <input type="number" min="0" step="0.01" value={String(it.valor_unitario)}
                      onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                      className="item-input" />
                  </ItemField>
                </div>

                {/* Fila 4: Observaciones */}
                <ItemField label="Observaciones">
                  <input value={it.observaciones} onChange={e => updateItem(idx, 'observaciones', e.target.value)}
                    placeholder="Notas sobre esta llanta..."
                    className="item-input" />
                </ItemField>

                {/* Toggle rechazo */}
                <button onClick={() => updateItem(idx, 'rechazo', !it.rechazo)}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition ${
                    it.rechazo
                      ? 'border-red-200 bg-red-100 text-red-700 hover:bg-red-50'
                      : 'border-navy-100 bg-navy-50 text-navy-400 hover:border-red-200 hover:text-red-500'
                  }`}>
                  {it.rechazo ? '✓ Marcada como rechazada — toca para quitar' : 'Marcar como rechazada (no se cobra)'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Totales */}
        <div className="space-y-2 border-t border-navy-100 bg-navy-50/50 px-5 py-4">
          {totalRechazado > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-400">Rechazado (no se cobra):</span>
              <span className="font-bold text-red-400 line-through">${totalRechazado.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-navy-400">Total a cobrar:</span>
            <span className="text-xl font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
          </div>
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
interface AlertaCredito {
  orden: Orden
  diasRestantes: number
  porVencer: boolean
  vencido: boolean
}

function OrdenesScreen({ refreshKey }: { refreshKey: number }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [alertas, setAlertas] = useState<AlertaCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Orden | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [data, al] = await Promise.all([mockApi.getOrdenes(), mockApi.getCreditosPorVencer()])
      setOrdenes(data)
      setAlertas(al)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshKey])

  if (loading) return <LoadingView />

  const alertasActivas = alertas.filter(a => a.porVencer || a.vencido)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Ordenes de Trabajo</h2>
        <button onClick={cargar} className="text-xs font-semibold text-navy-300 hover:text-navy-500">↻ Refrescar</button>
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Alertas de credito */}
      {alertasActivas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-700">
            <BellIcon /> Alertas de credito por vencer
          </h3>
          <div className="space-y-2">
            {alertasActivas.map(a => (
              <div key={a.orden.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <div>
                  <span className="text-sm font-bold text-navy-500">{a.orden.numero}</span>
                  <span className="ml-2 text-xs text-navy-300">{a.orden.cliente_nombre}</span>
                </div>
                <div className="text-right">
                  {a.vencido ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      Vencido hace {Math.abs(a.diasRestantes)} dias
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      Vence en {a.diasRestantes} dias
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-navy-300">
                    Venc: {new Date(a.orden.fecha_vencimiento!).toLocaleDateString('es-EC')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ordenes.length === 0 ? (
        <EmptyState text="No hay ordenes registradas. Cree una desde la pestana Nueva." />
      ) : (
        <div className="grid gap-3">
          {ordenes.map(o => {
            const cantValida = o.items.filter(it => !it.rechazo).reduce((s, it) => s + it.cantidad, 0)
            const alerta = alertas.find(a => a.orden.id === o.id)
            return (
              <button key={o.id} onClick={() => setSelected(o)}
                className="rounded-xl border border-navy-100 bg-white p-4 text-left shadow-sm transition hover:border-primary-200 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-navy-500">{o.numero}</span>
                  <EstadoBadge estado={o.estado} />
                </div>
                <p className="mt-1 text-sm font-semibold text-navy-400">{o.cliente_nombre || 'Cliente'}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-navy-300">
                  <span>{cantValida} items validos</span>
                  <span>Total: ${o.monto_total.toFixed(2)}</span>
                  {o.pagado_completo
                    ? <span className="font-bold text-green-600">Pagado</span>
                    : <span className="text-red-500">Pend: ${o.monto_pendiente.toFixed(2)}</span>}
                </div>
                {alerta && (alerta.porVencer || alerta.vencido) && (
                  <div className={`mt-2 rounded-lg px-2 py-1 text-xs font-bold ${alerta.vencido ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                    {alerta.vencido ? `Credito vencido hace ${Math.abs(alerta.diasRestantes)} dias` : `Credito vence en ${alerta.diasRestantes} dias`}
                  </div>
                )}
              </button>
            )
          })}
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
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [fechaVencPreview, setFechaVencPreview] = useState<string | null>(orden.fecha_vencimiento || null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const idxActual = ESTADOS.indexOf(orden.estado)
  const estadoSiguiente = idxActual < ESTADOS.length - 1 ? ESTADOS[idxActual + 1] : null
  const puedeEntregar = orden.estado === 'En bodega' && orden.pagado_completo
  const bloqueadoPorPago = orden.estado === 'En bodega' && !orden.pagado_completo

  const cambiarEstado = async (estado: EstadoOrden) => {
    setSaving(true); setMsg(null)
    try {
      await mockApi.cambiarEstado(orden.id, estado)
      setMsgType('success')
      setMsg(`Estado cambiado a: ${estado}`)
      onClose()
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) { setMsgType('error'); setMsg('Ingrese un monto valido'); return }
    setSaving(true); setMsg(null)
    try {
      await mockApi.registrarAbono(orden.id, monto)
      setAbonoMonto('')
      setMsgType('success')
      setMsg(`Abono de $${monto.toFixed(2)} registrado`)
      onClose()
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const definirPago = async () => {
    if (!tipoPago) return
    setSaving(true); setMsg(null)
    try {
      const actualizada = await mockApi.definirPago(orden.id, tipoPago as TipoPago)
      setFechaVencPreview(actualizada.fecha_vencimiento || null)
      setMsgType('success')
      const dias = diasDeCredito(tipoPago)
      if (dias > 0 && actualizada.fecha_vencimiento) {
        setMsg(`Credito a ${dias} dias. Vence el ${new Date(actualizada.fecha_vencimiento).toLocaleDateString('es-EC')}`)
      } else {
        setMsg(`Tipo de pago: ${tipoPago}`)
      }
      onClose()
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  // Calcular preview de vencimiento al cambiar tipo de pago
  const onTipoPagoChange = (val: string) => {
    setTipoPago(val)
    const dias = diasDeCredito(val)
    if (dias > 0) {
      const fecha = calcularFechaVencimiento(new Date(), dias)
      setFechaVencPreview(fecha.toISOString())
    } else {
      setFechaVencPreview(null)
    }
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-navy-500">Orden {orden.numero}</h3>
          <button onClick={onClose} className="text-lg text-navy-200 hover:text-navy-500">✕</button>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg px-3 py-2 text-xs font-medium ${msgType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        <p className="text-sm font-semibold text-navy-400">{orden.cliente_nombre}</p>
        <div className="mt-2"><EstadoBadge estado={orden.estado} /></div>

        {/* Trazabilidad */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Trazabilidad (secuencial)</h4>
        <div className="space-y-1">
          {ESTADOS.map((e, i) => {
            const fecha = i === 0 ? orden.fecha_rc : i === 1 ? orden.fecha_ef : i === 2 ? orden.fecha_rf : i === 3 ? orden.fecha_bodega : orden.fecha_ec
            const completado = i <= idxActual
            return (
              <div key={e} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${completado ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${completado ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                    {completado ? '✓' : i + 1}
                  </span>
                  <span className={completado ? 'font-bold text-green-700' : 'text-gray-400'}>{e}</span>
                </div>
                <span className="text-xs text-navy-300">
                  {fecha ? new Date(fecha).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Avanzar estado */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Avanzar estado operativo</h4>
        {estadoSiguiente ? (
          <div>
            <button onClick={() => cambiarEstado(estadoSiguiente)} disabled={saving}
              className={`w-full rounded-lg border px-4 py-3 text-sm font-bold transition ${
                estadoSiguiente === 'Entregado al cliente' && bloqueadoPorPago
                  ? 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed'
                  : 'border-primary-400 bg-primary-400 text-navy-500 hover:bg-primary-300'
              }`}>
              {saving ? 'Procesando...' : `→ Avanzar a: ${estadoSiguiente}`}
            </button>
            {estadoSiguiente === 'Entregado al cliente' && bloqueadoPorPago && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                No se puede entregar: el pago no esta completado. Pendiente: ${orden.monto_pendiente.toFixed(2)}
              </p>
            )}
            {estadoSiguiente === 'Entregado al cliente' && puedeEntregar && (orden.tipo_pago === 'Cheque' || orden.tipo_pago === 'Transferencia') && (
              <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                Pago verificado ({orden.tipo_pago}). Listo para entregar.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-600">Orden completada ✓</p>
        )}

        {/* Items */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Items ({orden.items.length})</h4>
        {orden.items.map((it, i) => {
          const subtotal = it.cantidad * it.valor_unitario
          return (
            <div key={i} className="flex items-center justify-between border-b border-navy-50 py-2">
              <div>
                <span className="text-sm text-navy-500">{it.cantidad}x {it.marca || 'Sin marca'} — {it.media || 'S/M'}</span>
                {it.rechazo && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RECHAZO (no se cobra)</span>}
              </div>
              <span className={`text-sm font-bold ${it.rechazo ? 'text-red-300 line-through' : 'text-navy-500'}`}>${subtotal.toFixed(2)}</span>
            </div>
          )
        })}

        {/* Pago */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Control de Pago</h4>
        <div className="rounded-lg bg-navy-50 p-4">
          <PagoRow label="Total (sin rechazados)" value={orden.monto_total} color="text-navy-500" />
          <PagoRow label="Abonado" value={orden.monto_abonado} color="text-green-600" />
          <PagoRow label="Pendiente" value={orden.monto_pendiente} color={orden.monto_pendiente > 0 ? 'text-red-500' : 'text-green-600'} />
        </div>

        {/* Tipo de pago + calendario de credito */}
        <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Tipo de pago</label>
        <select value={tipoPago} onChange={e => onTipoPagoChange(e.target.value)}
          className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
          <option value="">Sin definir</option>
          {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Preview de fecha de vencimiento */}
        {fechaVencPreview && (
          <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3">
            <div className="flex items-center gap-2">
              <CalendarIcon />
              <div>
                <p className="text-xs font-bold text-navy-500">
                  Vencimiento del credito: {new Date(fechaVencPreview).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="mt-0.5 text-[11px] text-navy-300">
                  {diasDeCredito(tipoPago)} dias habiles (excluye fines de semana y feriados del Ecuador)
                </p>
              </div>
            </div>
          </div>
        )}

        <button onClick={definirPago} disabled={saving || !tipoPago}
          className="mt-2 w-full rounded-lg bg-navy-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-600 disabled:opacity-60">
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
      const data = await mockApi.getResumen(anio, mes)
      setResumen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarResumen() }, [])

  const descargarExcel = () => { mockApi.downloadExcel(anio, mes) }

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
            <StatCard label="Prom. RC→RF" value={resumen.promedio_rc_rf_dias != null ? `${resumen.promedio_rc_rf_dias} dias` : '—'} />
            <StatCard label="Prom. EF→RF" value={resumen.promedio_ef_rf_dias != null ? `${resumen.promedio_ef_rf_dias} dias` : '—'} />
            <StatCard label="Prom. RC→EC" value={resumen.promedio_rc_ec_dias != null ? `${resumen.promedio_rc_ec_dias} dias` : '—'} />
          </div>
          <p className="mt-3 text-xs text-navy-200">Tiempos promedio en dias naturales (enteros)</p>
        </section>
      )}

      <button onClick={descargarExcel}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-400 px-4 py-3.5 text-sm font-bold text-navy-500 shadow-sm transition hover:bg-primary-300 active:scale-[0.99]">
        <DownloadIcon /> Descargar Excel por cliente
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
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-400" />
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

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function ItemField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-navy-300">{label}</label>
      {children}
    </div>
  )
}
