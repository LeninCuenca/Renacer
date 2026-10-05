import { useEffect, useState } from 'react'
import { ordenService } from '../services/ordenService'
import type { EstadoEvaluacionLlanta, Orden } from '../types'
import EstadoBadge from '../components/EstadoBadge'

type Evaluacion = { estado: EstadoEvaluacionLlanta; observaciones: string }
const evaluacionKey = (itemId: number, numeroLlanta: number) => `${itemId}-${numeroLlanta}`

export default function PlantaScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [seleccionada, setSeleccionada] = useState<Orden | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<Record<string, Evaluacion>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = async () => {
    try { setOrdenes((await ordenService.getOrdenes(true)).filter(orden => orden.estado === 'Envio a fabrica')) }
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

  return (
    <section className="space-y-5">
      <div><h2 className="text-xl font-bold text-navy-500">Administración de planta</h2><p className="text-sm text-navy-200">Evalúa cada unidad física antes del retorno de fábrica.</p></div>
      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="space-y-3">
        {ordenes.map(orden => <button type="button" key={orden.id} onClick={() => abrir(orden)} className="flex w-full items-center justify-between rounded-xl border border-navy-100 bg-white p-5 text-left shadow-sm hover:border-primary-300"><div><p className="font-bold text-navy-500">{orden.numero}</p><p className="text-sm text-navy-200">{orden.cliente_nombre || 'Sin cliente'} · {orden.items.reduce((total, item) => total + item.cantidad, 0)} llantas</p></div><EstadoBadge estado={orden.estado} /></button>)}
        {!ordenes.length && <p className="rounded-xl bg-white p-5 text-sm text-navy-200">No hay órdenes pendientes de evaluación.</p>}
      </div>
      {seleccionada && <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy-700/60 p-4 sm:items-center" onClick={() => setSeleccionada(null)}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><div><h3 className="text-xl font-bold text-navy-500">Evaluar {seleccionada.numero}</h3><p className="text-sm text-navy-200">Cada unidad se guarda por separado</p></div><button type="button" onClick={() => setSeleccionada(null)} className="text-xl text-navy-300">×</button></div>
        <p className="mb-4 rounded-lg bg-navy-50 px-3 py-2 text-xs font-bold text-navy-400">Evaluadas: {totalEvaluadas} de {totalUnidades}</p>
        <div className="space-y-4">
          {seleccionada.items.flatMap(item => Array.from({ length: item.cantidad }, (_, index) => ({ item, numero: index + 1 }))).map(({ item, numero }) => {
            const key = evaluacionKey(item.id || 0, numero)
            const evaluacion = evaluaciones[key] || { estado: 'pendiente' as EstadoEvaluacionLlanta, observaciones: '' }
            return <article key={key} className="rounded-lg border border-navy-100 p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-navy-500">Llanta {numero} · {item.marca || 'Sin marca'}</p><p className="text-xs text-navy-200">{item.media || 'Sin medida'} · Serie: {item.n_serie || 'N/D'}</p></div><span className={evaluacion.estado === 'valida' ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700' : evaluacion.estado === 'no_valida' ? 'rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700' : 'rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700'}>{evaluacion.estado}</span></div><textarea value={evaluacion.observaciones} onChange={event => guardarNota(item.id || 0, numero, event.target.value)} placeholder="Detalle: trabajo realizado, motivo de rechazo..." className="mt-3 w-full rounded-lg border border-navy-100 px-3 py-2 text-sm" rows={2} /><div className="mt-2 flex gap-2"><button type="button" disabled={saving === item.id} onClick={() => guardar(item.id || 0, numero, 'valida')} className="rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700">Guardar: valió</button><button type="button" disabled={saving === item.id} onClick={() => guardar(item.id || 0, numero, 'no_valida')} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700">Guardar: no valió</button></div></article>
          })}
        </div>
        <button type="button" disabled={saving === -1 || totalEvaluadas !== totalUnidades} onClick={retornar} className="mt-5 w-full rounded-lg bg-primary-400 px-4 py-3 font-bold text-navy-500 disabled:cursor-not-allowed disabled:opacity-50">{saving === -1 ? 'Procesando...' : totalEvaluadas === totalUnidades ? 'Marcar retorno de fábrica' : 'Evalúa todas las llantas para continuar'}</button>
      </div></div>}
    </section>
  )
}
