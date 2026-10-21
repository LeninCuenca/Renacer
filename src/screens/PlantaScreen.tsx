import { useEffect, useState } from 'react'
import { ordenService } from '../services/ordenService'
import type { EstadoEvaluacionLlanta, Orden } from '../types'
import EstadoBadge from '../components/EstadoBadge'
import TabBtn from '../components/ui/TabBtn'
import { reporteService } from '../services/reporteService'

type Evaluacion = { estado: EstadoEvaluacionLlanta; observaciones: string }
const evaluacionKey = (itemId: number, numeroLlanta: number) => `${itemId}-${numeroLlanta}`

export default function PlantaScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [tabActivo, setTabActivo] = useState<'pendientes' | 'historial'>('pendientes')
  const [seleccionada, setSeleccionada] = useState<Orden | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Record<string, Evaluacion>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [exporting, setExporting] = useState<'dia' | 'semana' | 'mes' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const exportarReporte = async (rango: 'dia' | 'semana' | 'mes') => {
    setExporting(rango); setError(null)
    try {
      await reporteService.exportarReportePlanta(rango)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar reporte')
    } finally {
      setExporting(null)
    }
  }

  const cargar = async () => {
    try { 
      const todas = await ordenService.getOrdenes(true)
      setOrdenes(todas)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las órdenes de planta.') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrir = async (orden: Orden) => {
    setSeleccionada(orden); setError(null)
    try {
      const data = await ordenService.getEvaluaciones(orden.id)
      const mapa: Record<string, Evaluacion> = {}
      data.forEach(item => { mapa[evaluacionKey(item.item_id, item.numero_llanta || 1)] = { estado: item.estado, observaciones: item.observaciones || '' } })
      setEvaluaciones(mapa)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las evaluaciones.') }
  }

  const guardar = async (itemId: number, numeroLlanta: number, estado: Exclude<EstadoEvaluacionLlanta, 'pendiente'>) => {
    if (!seleccionada) return
    const key = evaluacionKey(itemId, numeroLlanta)
    setSaving(itemId); setError(null)
    try {
      const actual = evaluaciones[key] || { estado, observaciones: '' }
      await ordenService.guardarEvaluacion({ itemId, ordenId: seleccionada.id, numeroLlanta, estado, observaciones: actual.observaciones })
      setEvaluaciones(prev => ({ ...prev, [key]: { ...actual, estado } }))
    } catch (e) { setError(e instanceof Error ? `No se pudo guardar la evaluación: ${e.message}` : 'No se pudo guardar la evaluación.') }
    finally { setSaving(null) }
  }

  const guardarNota = (itemId: number, numeroLlanta: number, observaciones: string) => {
    const key = evaluacionKey(itemId, numeroLlanta)
    setEvaluaciones(prev => ({ ...prev, [key]: { estado: prev[key]?.estado || 'pendiente', observaciones } }))
  }

  const totalUnidades = seleccionada?.items.reduce((total, item) => total + item.cantidad, 0) || 0
  const totalEvaluadas = seleccionada?.items.reduce((total, item) => total + Array.from({ length: item.cantidad }, (_, index) => evaluaciones[evaluacionKey(item.id || 0, index + 1)]).filter(item => item?.estado === 'valida' || item?.estado === 'no_valida').length, 0) || 0

  const retornar = async () => {
    if (!seleccionada || totalEvaluadas !== totalUnidades) { setError('Debe evaluar todas las llantas antes de marcar retorno de fábrica.'); return }
    setSaving(-1); setError(null)
    try { await ordenService.cambiarAretornoDesdePlanta(seleccionada.id); setSeleccionada(null); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.') }
    finally { setSaving(null) }
  }

  if (loading) return <p className="py-8 text-center text-sm text-navy-200">Cargando órdenes de planta...</p>

  const pendientes = ordenes.filter(o => o.estado === 'Envio a fabrica')
  const historial = ordenes.filter(o => ['Retorno de fabrica', 'En bodega', 'Entregado al cliente'].includes(o.estado))
  const mostrarOrdenes = tabActivo === 'pendientes' ? pendientes : historial

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-500">Administración de planta</h2>
          <p className="text-sm text-navy-200">Evalúa cada unidad física antes del retorno de fábrica o revisa el historial.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-navy-300">Exportar:</span>
          <button onClick={() => exportarReporte('dia')} disabled={exporting !== null} className="rounded-lg bg-white border border-navy-100 px-3 py-1.5 text-xs font-bold text-navy-500 hover:bg-navy-50 disabled:opacity-50">
            {exporting === 'dia' ? '...' : 'Diario'}
          </button>
          <button onClick={() => exportarReporte('semana')} disabled={exporting !== null} className="rounded-lg bg-white border border-navy-100 px-3 py-1.5 text-xs font-bold text-navy-500 hover:bg-navy-50 disabled:opacity-50">
            {exporting === 'semana' ? '...' : 'Semanal'}
          </button>
          <button onClick={() => exportarReporte('mes')} disabled={exporting !== null} className="rounded-lg bg-white border border-navy-100 px-3 py-1.5 text-xs font-bold text-navy-500 hover:bg-navy-50 disabled:opacity-50">
            {exporting === 'mes' ? '...' : 'Mensual'}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <TabBtn label={`Pendientes (${pendientes.length})`} active={tabActivo === 'pendientes'} onClick={() => setTabActivo('pendientes')} />
        <TabBtn label={`Historial (${historial.length})`} active={tabActivo === 'historial'} onClick={() => setTabActivo('historial')} />
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      
      <div className="space-y-3">
        {mostrarOrdenes.map(orden => (
          <button type="button" key={orden.id} onClick={() => abrir(orden)} className="flex w-full items-center justify-between rounded-xl border border-navy-100 bg-white p-5 text-left shadow-sm hover:border-primary-300 transition">
            <div>
              <p className="font-bold text-navy-500">{orden.numero}</p>
              <p className="text-sm text-navy-200">{orden.cliente_nombre || 'Sin cliente'} · {orden.items.reduce((total, item) => total + item.cantidad, 0)} llantas</p>
            </div>
            <EstadoBadge estado={orden.estado} />
          </button>
        ))}
        {!mostrarOrdenes.length && (
          <p className="rounded-xl bg-white p-5 text-sm text-navy-200">
            {tabActivo === 'pendientes' ? 'No hay órdenes pendientes de evaluación.' : 'No hay historial de órdenes evaluadas.'}
          </p>
        )}
      </div>

      {seleccionada && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy-700/60 p-4 sm:items-center" onClick={() => setSeleccionada(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-navy-500">{tabActivo === 'pendientes' ? 'Evaluar' : 'Ver detalle'} {seleccionada.numero}</h3>
                <p className="text-sm text-navy-200">Cada unidad se guarda por separado</p>
              </div>
              <button type="button" onClick={() => setSeleccionada(null)} className="text-xl text-navy-300 hover:text-navy-500 transition">×</button>
            </div>

            {tabActivo === 'historial' && (
              <button type="button" disabled={saving === -1} onClick={async () => {
                setSaving(-1); setError(null);
                try {
                  await reporteService.exportarNotaEntrega(seleccionada);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Error al exportar nota de entrega');
                } finally {
                  setSaving(null);
                }
              }} className="mb-4 w-full rounded-lg border border-navy-500 bg-white px-4 py-2.5 text-sm font-bold text-navy-500 hover:bg-navy-50 transition disabled:cursor-not-allowed disabled:opacity-50">
                {saving === -1 ? 'Generando...' : 'Exportar Nota de Entrega (Excel)'}
              </button>
            )}
            
            <p className="mb-4 rounded-lg bg-navy-50 px-3 py-2 text-xs font-bold text-navy-400">Evaluadas: {totalEvaluadas} de {totalUnidades}</p>
            
            <div className="space-y-4">
              {seleccionada.items.flatMap(item => Array.from({ length: item.cantidad }, (_, index) => ({ item, numero: index + 1 }))).map(({ item, numero }) => {
                const key = evaluacionKey(item.id || 0, numero)
                const evaluacion = evaluaciones[key] || { estado: 'pendiente' as EstadoEvaluacionLlanta, observaciones: '' }
                return (
                  <article key={key} className="rounded-lg border border-navy-100 p-4 bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-navy-500">Llanta {numero} · {item.marca || 'Sin marca'}</p>
                        <p className="text-xs text-navy-200">{item.media || 'Sin medida'} · Serie: {item.n_serie || 'N/D'}</p>
                      </div>
                      <span className={evaluacion.estado === 'valida' ? 'rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700' : evaluacion.estado === 'no_valida' ? 'rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700' : 'rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700'}>{evaluacion.estado.replace('_', ' ')}</span>
                    </div>
                    
                    <textarea 
                      value={evaluacion.observaciones} 
                      onChange={event => guardarNota(item.id || 0, numero, event.target.value)} 
                      placeholder="Detalle: trabajo realizado, motivo de rechazo..." 
                      className="mt-3 w-full rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:bg-navy-50 disabled:cursor-not-allowed" 
                      rows={2} 
                      disabled={tabActivo === 'historial'}
                    />
                    
                    {tabActivo === 'pendientes' && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={saving === item.id} onClick={() => guardar(item.id || 0, numero, 'valida')} className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 border border-green-200 transition">Guardar: valió</button>
                        <button type="button" disabled={saving === item.id} onClick={() => guardar(item.id || 0, numero, 'no_valida')} className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 border border-red-200 transition">Guardar: no valió</button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            
            {tabActivo === 'pendientes' && (
              <button type="button" disabled={saving === -1 || totalEvaluadas !== totalUnidades} onClick={retornar} className="mt-5 w-full rounded-lg bg-primary-400 px-4 py-3 font-bold text-navy-500 hover:bg-primary-300 transition disabled:cursor-not-allowed disabled:opacity-50">
                {saving === -1 ? 'Procesando...' : totalEvaluadas === totalUnidades ? 'Marcar retorno de fábrica' : 'Evalúa todas las llantas para continuar'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
