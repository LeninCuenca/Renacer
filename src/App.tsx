import { useState, useEffect, useCallback, useRef } from 'react'
import type { Cliente, Orden, Item, EstadoOrden, TipoPago, ResumenReporte } from './types'
import { ESTADOS, TIPOS_PAGO, DIRECCIONES, MEDIDAS_LLANTAS, diasDeCredito, calcularFechaVencimiento, esFeriado, esFinDeSemana } from './types'
import { supabaseApi } from './supabaseApi'

// ============================================================
// App principal
// ============================================================
type Tab = 'ordenes' | 'nueva' | 'clientes' | 'reporte'

export default function App() {
  const [tab, setTab] = useState<Tab>('ordenes')
  const [refreshKey, setRefreshKey] = useState(0)
  const [alertasCount, setAlertasCount] = useState(0)

  useEffect(() => {
    supabaseApi.getCreditosPorVencer().then(alertas => {
      setAlertasCount(alertas.filter(a => a.porVencer || a.vencido).length)
    }).catch(() => {})
  }, [refreshKey])

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-navy-500 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <img src="/logo.svg" alt="Renacer" className="h-12 w-12 object-contain"/>
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
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroDir, setFiltroDir] = useState<string>('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const data = await supabaseApi.getClientes()
      setClientes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setNombre(''); setCedula(''); setTelefono(''); setDireccion('')
    setShowForm(true); setError(null)
  }

  const abrirEditar = (c: Cliente) => {
    setEditando(c)
    setNombre(c.nombre); setCedula(c.cedula)
    setTelefono(c.telefono || ''); setDireccion(c.direccion || '')
    setShowForm(true); setError(null)
  }

  const cancelar = () => {
    setShowForm(false); setEditando(null)
    setNombre(''); setCedula(''); setTelefono(''); setDireccion('')
    setError(null)
  }

  const validar = (): boolean => {
    if (!nombre.trim()) { setError('El nombre del cliente es obligatorio'); return false }
    if (!cedula.trim()) { setError('La cédula o RUC es obligatorio'); return false }
    const cedulaLimpia = cedula.trim().replace(/\s/g, '')
    if (!/^\d{10}$/.test(cedulaLimpia) && !/^\d{13}$/.test(cedulaLimpia)) {
      setError('Ingrese una cédula válida (10 dígitos) o un RUC válido (13 dígitos)'); return false
    }
    if (telefono.trim() && !/^[\d\s\-\+\(\)]{7,15}$/.test(telefono.trim())) {
      setError('El número de teléfono no es válido'); return false
    }
    return true
  }

  const guardar = async () => {
    if (!validar()) return
    const cedulaLimpia = cedula.trim().replace(/\s/g, '')
    setSaving(true); setError(null)
    try {
      if (editando) {
        await supabaseApi.updateCliente(editando.id, {
          nombre: nombre.trim(), cedula: cedulaLimpia,
          telefono: telefono || null, direccion: direccion || null,
        })
      } else {
        await supabaseApi.createCliente({ nombre: nombre.trim(), cedula: cedulaLimpia, telefono: telefono || null, direccion: direccion || null })
      }
      cancelar(); cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (c: Cliente) => {
    const nuevoEstado = !(c.activo !== false)
    const accion = nuevoEstado ? 'activar' : 'desactivar'
    if (!window.confirm(`¿Desea ${accion} al cliente "${c.nombre}"?`)) return
    try {
      await supabaseApi.toggleActivoCliente(c.id, nuevoEstado)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Error al ${accion}`)
    }
  }

  const clientesActivos = clientes.filter(c => c.activo !== false)
  const clientesInactivos = clientes.filter(c => c.activo === false)
  const clientesMostrados = (mostrarInactivos ? clientesInactivos : clientesActivos)
    .filter(c => filtroDir ? c.direccion === filtroDir : true)
  const conteoDir = DIRECCIONES.map(d => ({
    direccion: d,
    count: clientesActivos.filter(c => c.direccion === d).length
  })).filter(d => d.count > 0)

  if (loading) return <LoadingView />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Clientes</h2>
        <button onClick={abrirNuevo} className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-bold text-navy-500 transition hover:bg-primary-300">
          + Nuevo
        </button>
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Formulario crear / editar */}
      {showForm && (
        <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy-500">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <button onClick={cancelar} className="text-sm text-navy-200 hover:text-navy-500">✕ Cancelar</button>
          </div>
          <Input label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Juan Perez" />
          <Input label="Cedula / RUC *" value={cedula} onChange={v => setCedula(v.replace(/\D/g, '').slice(0, 13))} placeholder="1700000000 o 1700000000001" type="tel" inputMode="numeric" pattern="[0-9]*" hint={cedula.length === 10 ? '✓ Cédula (10 dígitos)' : cedula.length === 13 ? '✓ RUC (13 dígitos)' : cedula.length > 0 ? `${cedula.length}/10 o 13 dígitos` : undefined} />
          <Input label="Telefono" value={telefono} onChange={setTelefono} placeholder="098 765 4321" type="tel" inputMode="numeric" pattern="[0-9]*" />
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
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Tabs activos / inactivos */}
      <div className="flex gap-2">
        <button onClick={() => { setMostrarInactivos(false); setFiltroDir('') }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${!mostrarInactivos ? 'bg-navy-500 text-white' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
          Activos ({clientesActivos.length})
        </button>
        <button onClick={() => { setMostrarInactivos(true); setFiltroDir('') }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${mostrarInactivos ? 'bg-red-500 text-white' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
          Inactivos ({clientesInactivos.length})
        </button>
      </div>

      {!mostrarInactivos && conteoDir.length > 0 && (
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

      {clientesMostrados.length === 0 ? (
        <EmptyState text={mostrarInactivos ? 'No hay clientes inactivos' : 'No hay clientes registrados'} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clientesMostrados.map(c => (
            <div key={c.id} className={`rounded-xl border bg-white p-4 shadow-sm ${c.activo === false ? 'border-red-100 opacity-70' : 'border-navy-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-navy-500">{c.nombre}</p>
                    {c.activo === false && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">INACTIVO</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-navy-300">Cédula/RUC: {c.cedula}</p>
                  {c.telefono && <p className="text-xs text-navy-300">Tel: {c.telefono}</p>}
                  {c.direccion && <p className="mt-1.5 inline-block rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-400">{c.direccion}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => abrirEditar(c)}
                    className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[11px] font-bold text-navy-500 hover:bg-primary-100 transition">
                    ✏️ Editar
                  </button>
                  <button onClick={() => toggleActivo(c)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${c.activo === false ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {c.activo === false ? '✓ Activar' : '⊘ Desactivar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Componente: Buscador de clientes
// ============================================================
function ClienteSearchSelect({
  clientes,
  clienteId,
  onSelect,
}: {
  clientes: Cliente[]
  clienteId: number
  onSelect: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const clienteSeleccionado = clientes.find(c => c.id === clienteId) || null

  const filtrados = query.trim().length === 0
    ? clientes
    : clientes.filter(c => {
        const q = query.toLowerCase()
        return c.nombre.toLowerCase().includes(q) || c.cedula.includes(q)
      })

  // Cerrar al tocar fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const seleccionar = (c: Cliente) => {
    onSelect(c.id)
    setQuery('')
    setOpen(false)
  }

  const limpiar = () => {
    onSelect(0)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="mb-4" ref={wrapperRef}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Cliente *</label>

      {/* Cliente seleccionado */}
      {clienteSeleccionado && !open ? (
        <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3 py-2.5">
          <div>
            <p className="text-sm font-bold text-navy-500">{clienteSeleccionado.nombre}</p>
            <p className="text-xs text-navy-300">{clienteSeleccionado.cedula}{clienteSeleccionado.direccion ? ` · ${clienteSeleccionado.direccion}` : ''}</p>
          </div>
          <button onClick={limpiar}
            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-navy-300 hover:bg-red-50 hover:text-red-500 transition">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Input de busqueda */}
          <div className="flex items-center rounded-lg border border-navy-100 bg-white px-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200">
            <svg className="mr-2 h-4 w-4 shrink-0 text-navy-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              autoFocus={open}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar por nombre o cedula..."
              className="w-full py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="ml-1 text-navy-200 hover:text-navy-500">✕</button>
            )}
          </div>

          {/* Dropdown de resultados */}
          {open && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-navy-100 bg-white shadow-lg">
              {filtrados.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-navy-200">
                  Sin resultados para «{query}»
                </div>
              ) : (
                filtrados.map(c => (
                  <button key={c.id} onClick={() => seleccionar(c)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-primary-50 active:bg-primary-100 border-b border-navy-50 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-navy-500">{c.nombre}</p>
                      <p className="text-xs text-navy-300">{c.cedula}{c.direccion ? ` · ${c.direccion}` : ''}</p>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-navy-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          )}
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
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)

  // Campos del formulario temporal
  const [fMarca, setFMarca] = useState('')
  const [fSerie, setFSerie] = useState('')
  const [fMedia, setFMedia] = useState('')
  const [fDiseno, setFDiseno] = useState('')
  const [fCantidad, setFCantidad] = useState(1)
  const [fValor, setFValor] = useState(0)
  const [fObs, setFObs] = useState('')
  const [fRechazo, setFRechazo] = useState(false)

  useEffect(() => { supabaseApi.getClientes().then(setClientes).catch(() => {}) }, [])

  const limpiarFormulario = () => {
    setFMarca(''); setFSerie(''); setFMedia(''); setFDiseno('')
    setFCantidad(1); setFValor(0); setFObs(''); setFRechazo(false)
  }

  const agregarLlanta = () => {
    if (!fMarca.trim() && !fMedia) { setError('Ingrese al menos la marca o la medida'); return }
    const nuevo: Item = {
      marca: fMarca || null, n_serie: fSerie || null,
      media: fMedia || null, diseno: fDiseno || null,
      cantidad: fCantidad, valor_unitario: fValor,
      rechazo: fRechazo, observaciones: fObs,
    }
    setItems(prev => [...prev, nuevo])
    limpiarFormulario()
    setListaAbierta(true)
    setError(null)
  }

  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const toggleRechazo = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, rechazo: !it.rechazo } : it))
  }

  const totalEstimado = items.filter(it => !it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)
  const totalRechazado = items.filter(it => it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)

  const guardar = async () => {
    if (!clienteId || !numero.trim()) { setError('Seleccione cliente e ingrese numero de orden'); return }
    if (items.length === 0) { setError('Agregue al menos una llanta'); return }
    setSaving(true); setError(null)
    try {
      await supabaseApi.createOrden({
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
        <ClienteSearchSelect
          clientes={clientes}
          clienteId={clienteId}
          onSelect={setClienteId}
        />
        <Input label="Numero de orden *" value={numero} onChange={setNumero} placeholder="OT-0001" />
        <Input label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas..." multiline />
      </section>

      {/* Formulario para agregar una llanta */}
      <section className="rounded-xl border border-navy-100 bg-white shadow-sm">
        <div className="border-b border-navy-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">2</span>
            Registrar llanta
          </h3>
          <p className="mt-1 text-xs text-navy-300">Llene los datos y toque "Agregar llanta" para anadirla a la lista.</p>
        </div>

        <div className="space-y-2.5 p-5">
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Marca">
              <input value={fMarca} onChange={e => setFMarca(e.target.value)} placeholder="Ej: Michelin" className="item-input" />
            </ItemField>
            <ItemField label="N° Serie">
              <input value={fSerie} onChange={e => setFSerie(e.target.value)} placeholder="Ej: SN-0001" className="item-input" />
            </ItemField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Medida">
              <select value={fMedia} onChange={e => setFMedia(e.target.value)} className="item-input">
                <option value="">Seleccionar...</option>
                {MEDIDAS_LLANTAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </ItemField>
            <ItemField label="Diseño">
              <input value={fDiseno} onChange={e => setFDiseno(e.target.value)} placeholder="Ej: Rayado" className="item-input" />
            </ItemField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Cantidad">
              <input type="number" min="1" value={String(fCantidad)} onChange={e => setFCantidad(parseInt(e.target.value) || 1)} className="item-input" />
            </ItemField>
            <ItemField label="Valor unitario ($)">
              <input type="number" min="0" step="0.01" value={String(fValor)} onChange={e => setFValor(parseFloat(e.target.value) || 0)} className="item-input" />
            </ItemField>
          </div>
          <ItemField label="Observaciones">
            <input value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Notas sobre esta llanta..." className="item-input" />
          </ItemField>

          <button onClick={() => setFRechazo(!fRechazo)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition ${
              fRechazo
                ? 'border-red-200 bg-red-100 text-red-700 hover:bg-red-50'
                : 'border-navy-100 bg-navy-50 text-navy-400 hover:border-red-200 hover:text-red-500'
            }`}>
            {fRechazo ? '✓ Marcada como rechazada — toca para quitar' : 'Marcar como rechazada (no se cobra)'}
          </button>

          <button onClick={agregarLlanta}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-navy-600 active:scale-95">
            <span className="text-base leading-none">+</span> Agregar llanta
          </button>
        </div>
      </section>

      {/* Lista desplegable de llantas agregadas */}
      {items.length > 0 && (
        <section className="rounded-xl border border-navy-100 bg-white shadow-sm">
          <button onClick={() => setListaAbierta(!listaAbierta)}
            className="flex w-full items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-navy-500">Llantas agregadas</h3>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-navy-500">{items.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
              <span className={`text-navy-300 transition-transform ${listaAbierta ? 'rotate-180' : ''}`}>
                <ChevronIcon />
              </span>
            </div>
          </button>

          {listaAbierta && (
            <div className="divide-y divide-navy-50 border-t border-navy-100">
              {items.map((it, idx) => {
                const subtotal = it.cantidad * it.valor_unitario
                return (
                  <div key={idx} className={`px-5 py-3 ${it.rechazo ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[10px] font-extrabold text-navy-500">
                          {idx + 1}
                        </span>
                        <div>
                          <p className={`text-sm font-bold ${it.rechazo ? 'text-red-400 line-through' : 'text-navy-500'}`}>
                            {it.cantidad}x {it.marca || 'Sin marca'} — {it.media || 'S/M'}
                          </p>
                          <p className="text-xs text-navy-300">
                            {it.n_serie ? `Serie: ${it.n_serie} · ` : ''}{it.diseno ? `Diseño: ${it.diseno}` : ''}
                          </p>
                          {it.observaciones && <p className="text-xs text-navy-300">Obs: {it.observaciones}</p>}
                          {it.rechazo && <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RECHAZADA</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-sm font-bold ${it.rechazo ? 'text-red-300 line-through' : 'text-navy-500'}`}>${subtotal.toFixed(2)}</span>
                        <button onClick={() => toggleRechazo(idx)}
                          className={`rounded px-2 py-1 text-[10px] font-bold transition ${it.rechazo ? 'bg-green-100 text-green-700 hover:bg-green-50' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                          {it.rechazo ? 'Activar' : 'Rechazar'}
                        </button>
                        <button onClick={() => quitarItem(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-navy-200 transition hover:bg-red-50 hover:text-red-500">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Totales */}
              <div className="space-y-1 bg-navy-50/50 px-5 py-4">
                {totalRechazado > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400">Rechazado (no se cobra):</span>
                    <span className="font-bold text-red-400 line-through">${totalRechazado.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy-400">Total a cobrar:</span>
                  <span className="text-lg font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

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
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [alertas, setAlertas] = useState<AlertaCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Orden | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [data, al, clientesData] = await Promise.all([
        supabaseApi.getOrdenes(),
        supabaseApi.getCreditosPorVencer(),
        supabaseApi.getClientes(),
      ])
      setOrdenes(data)
      setAlertas(al)
      setClientes(clientesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshKey])

  if (loading) return <LoadingView />

  const alertasActivas = alertas.filter(a => a.porVencer || a.vencido)

  // Filtro de búsqueda
  const q = busqueda.trim().toLowerCase()
  const ordenesFiltradas = q === ''
    ? ordenes
    : ordenes.filter(o => {
        if (o.numero.toLowerCase().includes(q)) return true
        if ((o.cliente_nombre || '').toLowerCase().includes(q)) return true
        // Buscar por cédula/RUC del cliente
        const cliente = clientes.find(c => c.id === o.cliente_id)
        if (cliente && cliente.cedula.includes(q)) return true
        return false
      })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Ordenes de Trabajo</h2>
        <button onClick={cargar} className="text-xs font-semibold text-navy-300 hover:text-navy-500">↻ Refrescar</button>
      </div>

      {/* Buscador */}
      <div className="flex items-center rounded-xl border border-navy-100 bg-white px-3 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200">
        <svg className="mr-2 h-4 w-4 shrink-0 text-navy-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por Nº orden, nombre o cédula/RUC..."
          className="w-full py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:outline-none bg-transparent"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="ml-1 shrink-0 text-navy-200 hover:text-navy-500">✕</button>
        )}
      </div>

      {busqueda && (
        <p className="text-xs text-navy-300">
          {ordenesFiltradas.length === 0
            ? `Sin resultados para «${busqueda}»`
            : `${ordenesFiltradas.length} resultado${ordenesFiltradas.length !== 1 ? 's' : ''} para «${busqueda}»`
          }
        </p>
      )}

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

      {ordenesFiltradas.length === 0 && busqueda === '' ? (
        <EmptyState text="No hay ordenes registradas. Cree una desde la pestana Nueva." />
      ) : ordenesFiltradas.length === 0 ? (
        <EmptyState text={`Sin resultados para «${busqueda}». Intente con otro término.`} />
      ) : (
        <div className="grid gap-3">
          {ordenesFiltradas.map(o => {
            const cantValida = o.items.filter(it => !it.rechazo).reduce((s, it) => s + it.cantidad, 0)
            const alerta = alertas.find(a => a.orden.id === o.id)

            // Calcular etiqueta de fecha relativa
            const fechaCreacion = o.created_at ? new Date(o.created_at) : null
            let fechaRelativa = ''
            let fechaCorta = ''
            if (fechaCreacion) {
              fechaCorta = fechaCreacion.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
              const hoy = new Date()
              const diffMs = hoy.getTime() - fechaCreacion.getTime()
              const diffDias = Math.floor(diffMs / 86400000)
              if (diffDias === 0) fechaRelativa = 'Hoy'
              else if (diffDias === 1) fechaRelativa = 'Ayer'
              else if (diffDias < 7) fechaRelativa = `Hace ${diffDias} días`
              else if (diffDias < 30) fechaRelativa = `Hace ${Math.floor(diffDias / 7)} sem.`
              else if (diffDias < 365) fechaRelativa = `Hace ${Math.floor(diffDias / 30)} mes.`
              else fechaRelativa = `Hace ${Math.floor(diffDias / 365)} año(s)`
            }

            return (
              <button key={o.id} onClick={() => setSelected(o)}
                className="rounded-xl border border-navy-100 bg-white p-4 text-left shadow-sm transition hover:border-primary-200 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-navy-500">{o.numero}</span>
                  <EstadoBadge estado={o.estado} />
                </div>
                <p className="mt-1 text-sm font-semibold text-navy-400">{o.cliente_nombre || 'Cliente'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-navy-300">
                  <span>{cantValida} items validos</span>
                  <span>Total: ${o.monto_total.toFixed(2)}</span>
                  {o.pagado_completo
                    ? <span className="font-bold text-green-600">Pagado</span>
                    : <span className="text-red-500">Pend: ${o.monto_pendiente.toFixed(2)}</span>}
                </div>
                {fechaCreacion && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-navy-200">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span className="font-semibold">{fechaRelativa}</span>
                    <span>·</span>
                    <span>{fechaCorta}</span>
                  </div>
                )}
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
  const [historialAbonos, setHistorialAbonos] = useState<any[]>([])
  const [loadingAbonos, setLoadingAbonos] = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Cargar historial de abonos
  const cargarAbonos = async () => {
    try {
      const data = await supabaseApi.getAbonos(orden.id)
      setHistorialAbonos(data)
    } catch (_) {}
    finally { setLoadingAbonos(false) }
  }

  useEffect(() => { cargarAbonos() }, [])

  const idxActual = ESTADOS.indexOf(orden.estado)
  const estadoSiguiente = idxActual < ESTADOS.length - 1 ? ESTADOS[idxActual + 1] : null
  const puedeEntregar = orden.estado === 'En bodega' && orden.pagado_completo
  const bloqueadoPorPago = orden.estado === 'En bodega' && !orden.pagado_completo

  const cambiarEstado = async (estado: EstadoOrden) => {
    setSaving(true); setMsg(null)
    try {
      await supabaseApi.updateOrdenEstado(orden.id, estado)
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
      await supabaseApi.createAbono({ orden_id: orden.id, monto })
      setAbonoMonto('')
      setMsgType('success')
      setMsg(`Abono de $${monto.toFixed(2)} registrado correctamente`)
      // Recargar historial sin cerrar el modal
      await cargarAbonos()
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
      const actualizada = await supabaseApi.setPagoPago(orden.id, tipoPago as TipoPago)
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

        {/* Historial de abonos */}
        {loadingAbonos ? (
          <p className="mb-3 text-xs text-navy-200">Cargando historial...</p>
        ) : historialAbonos.length > 0 ? (
          <div className="mb-3 rounded-xl border border-navy-100 bg-navy-50 overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-navy-300">Historial de abonos ({historialAbonos.length})</p>
            <div className="divide-y divide-navy-100">
              {historialAbonos.map((a, i) => (
                <div key={a.id || i} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-green-600">+${Number(a.monto).toFixed(2)}</p>
                    {a.descripcion && <p className="text-[10px] text-navy-300">{a.descripcion}</p>}
                  </div>
                  <p className="text-[11px] text-navy-300">
                    {a.fecha
                      ? new Date(a.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'
                    }
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-navy-100 bg-white px-3 py-2">
              <span className="text-xs font-bold text-navy-400">Total abonado:</span>
              <span className="text-xs font-bold text-green-600">${historialAbonos.reduce((s, a) => s + Number(a.monto), 0).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="mb-3 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-300">Sin abonos registrados aún.</p>
        )}

        {/* Campo y botón de nuevo abono */}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              step="0.01"
              min="0"
              value={abonoMonto}
              onChange={e => setAbonoMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <button onClick={registrarAbono} disabled={saving || !abonoMonto}
            className="shrink-0 rounded-lg bg-primary-400 px-4 py-2.5 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
            {saving ? '...' : '+ Abonar'}
          </button>
        </div>

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
      const data = await supabaseApi.getResumenMensual(anio, mes)
      setResumen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarResumen() }, [])

  const descargarExcel = async () => {
    try {
      await supabaseApi.exportarExcelMensual(anio, mes)
    } catch (e) {
      setError('Error al descargar Excel: ' + (e instanceof Error ? e.message : 'Error desconocido'))
    }
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
              {[
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
              ].map((nombre, i) => <option key={i + 1} value={i + 1}>{nombre}</option>)}
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
          <h3 className="mb-4 text-sm font-bold text-navy-500">Resumen {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][resumen.mes - 1]} {resumen.anio}</h3>
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
  label, value, onChange, placeholder, type, multiline, hint, inputMode, pattern,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
  hint?: string
  inputMode?: 'numeric' | 'tel' | 'decimal' | 'text' | 'none' | 'search' | 'email' | 'url'
  pattern?: string
}) {
  const isHintOk = hint && hint.startsWith('✓')
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wide text-navy-300">{label}</label>
        {hint && (
          <span className={`text-[10px] font-bold ${isHintOk ? 'text-green-600' : 'text-navy-300'}`}>{hint}</span>
        )}
      </div>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="min-h-[70px] w-full resize-y rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200" />
      ) : (
        <input
          type={type || 'text'}
          inputMode={inputMode}
          pattern={pattern}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:outline-none focus:ring-2 transition ${
            isHintOk
              ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
              : 'border-navy-100 focus:border-primary-400 focus:ring-primary-200'
          }`} />
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
    <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white">!</span>
      <p className="flex-1 text-sm font-medium text-red-700">{message}</p>
      <button onClick={onClose} className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-600" title="Cerrar">×</button>
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

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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
