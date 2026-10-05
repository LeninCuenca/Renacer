import { useState, useEffect, useCallback } from 'react'
import type { Cliente, Orden, EstadoOrden, Rol } from '../types'
import type { AlertaCredito } from '../types'
import { ESTADOS } from '../types'
import { ordenService } from '../services/ordenService'
import { clienteService } from '../services/clienteService'
import EstadoBadge from '../components/EstadoBadge'
import ErrorBox from '../components/ui/ErrorBox'
import LoadingView from '../components/ui/LoadingView'
import EmptyState from '../components/ui/EmptyState'
import { BellIcon, CalendarSmallIcon } from '../components/icons'
import OrdenDetalleModal from './OrdenDetalleModal'

export default function OrdenesScreen({ refreshKey, rol }: { refreshKey: number; rol: Rol }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [alertas, setAlertas] = useState<AlertaCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [recargando, setRecargando] = useState(false)
  const [selected, setSelected] = useState<Orden | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'Todos'>('Todos')

  const cargar = useCallback(async (forzar = false) => {
    try {
      // 1) Intentar caché primero → respuesta instantánea
      const cacheData = await ordenService.getOrdenes(false)
      if (cacheData.length > 0 && !forzar) {
        setOrdenes(cacheData)
        setLoading(false)
        setRecargando(true)
      }

      // 2) Recargar desde BD (forzar = true omite caché)
      const [data, al, clientesData] = await Promise.all([
        ordenService.getOrdenes(true),
        ordenService.getCreditosPorVencer(),
        clienteService.getClientes(),
      ])
      setOrdenes(data)
      setAlertas(al)
      setClientes(clientesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
      setRecargando(false)
    }
  }, [])

  // Actualizar una orden en la lista local sin recargar todo
  const actualizarOrdenLocal = useCallback((ordenActualizada: Orden) => {
    setOrdenes(prev => prev.map(o => o.id === ordenActualizada.id ? ordenActualizada : o))
    setSelected(ordenActualizada)
  }, [])

  useEffect(() => { cargar(refreshKey > 0) }, [cargar, refreshKey])

  if (loading) return <LoadingView />

  const alertasActivas = alertas.filter(a => a.porVencer || a.vencido)

  // Filtro de búsqueda
  const q = busqueda.trim().toLowerCase()
  const ordenesPorBusqueda = q === ''
    ? ordenes
    : ordenes.filter(o => {
        if (o.numero.toLowerCase().includes(q)) return true
        if ((o.cliente_nombre || '').toLowerCase().includes(q)) return true
        const cliente = clientes.find(c => c.id === o.cliente_id)
        if (cliente && cliente.cedula.includes(q)) return true
        return false
      })

  // Filtro por estado
  const ordenesFiltradas = filtroEstado === 'Todos'
    ? ordenesPorBusqueda
    : ordenesPorBusqueda.filter(o => o.estado === filtroEstado)

  // Conteos por estado para los chips
  const conteoEstados: Record<string, number> = { Todos: ordenesPorBusqueda.length }
  for (const e of ESTADOS) {
    conteoEstados[e] = ordenesPorBusqueda.filter(o => o.estado === e).length
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Ordenes de Trabajo</h2>
        <button onClick={() => cargar(true)} disabled={recargando}
          className={`flex items-center gap-1 text-xs font-semibold transition ${recargando ? 'text-navy-200' : 'text-navy-300 hover:text-navy-500'}`}>
          <span className={recargando ? 'animate-spin inline-block' : ''}>↻</span>
          {recargando ? 'Actualizando...' : 'Refrescar'}
        </button>
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

      {/* Filtros por estado */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['Todos', ...ESTADOS] as (EstadoOrden | 'Todos')[]).map(e => {
          const activo = filtroEstado === e
          const cnt = conteoEstados[e] ?? 0
          return (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activo
                  ? 'border-navy-500 bg-navy-500 text-white'
                  : 'border-navy-100 bg-white text-navy-400 hover:border-navy-300'
              }`}>
              {e === 'Todos' ? 'Todos' : e}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activo ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-400'
              }`}>{cnt}</span>
            </button>
          )
        })}
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

      {ordenesFiltradas.length === 0 && busqueda === '' && filtroEstado === 'Todos' ? (
        <EmptyState text="No hay ordenes registradas. Cree una desde la pestana Nueva." />
      ) : ordenesFiltradas.length === 0 ? (
        <EmptyState text={busqueda ? `Sin resultados para «${busqueda}».` : `No hay ordenes en estado "${filtroEstado}".`} />
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
                {o.vendedor_nombre && <p className="mt-1 text-xs text-navy-200">Vendedor: {o.vendedor_nombre}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-navy-300">
                  <span>{cantValida} items validos</span>
                  <span>Total: ${o.monto_total.toFixed(2)}</span>
                  {o.pagado_completo
                    ? <span className="font-bold text-green-600">Pagado</span>
                    : <span className="text-red-500">Pend: ${o.monto_pendiente.toFixed(2)}</span>}
                </div>
                {fechaCreacion && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-navy-200">
                    <CalendarSmallIcon />
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

      {selected && <OrdenDetalleModal orden={selected} rol={rol} onOrdenActualizada={actualizarOrdenLocal} onClose={() => { setSelected(null); cargar() }} />}
    </div>
  )
}
