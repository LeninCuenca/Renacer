import { useEffect, useState } from 'react'
import { DIAS_PLANIFICACION, inicioDeSemana, planificacionService, rangoDeSemana } from '../services/planificacionService'
import type { PlanificacionSemanal } from '../types'
import type { EdicionPlanificacion } from '../types'

export default function PlanificacionScreen({ vendedorId, readOnly = false, nombreVendedor }: { vendedorId: string; readOnly?: boolean; nombreVendedor?: string }) {
  const [semana, setSemana] = useState(inicioDeSemana())
  const [filas, setFilas] = useState(DIAS_PLANIFICACION.map(({ dia }) => ({ dia, ubicacion: '', notas: '' })))
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    planificacionService.getPorVendedor(vendedorId, semana).then(data => setFilas(DIAS_PLANIFICACION.map(({ dia }) => { const found = data.find(item => item.dia === dia); return { dia, ubicacion: found?.ubicacion || '', notas: found?.notas || '' } }))).catch(e => setError(e.message))
  }, [vendedorId, semana])

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setMensaje(null)
    try { await planificacionService.guardar(vendedorId, semana, filas); setMensaje('Planificación guardada correctamente.') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la planificación.') }
    finally { setSaving(false) }
  }

  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold text-navy-500">Planificación semanal</h2><p className="text-sm text-navy-200">{readOnly ? `Ruta de ${nombreVendedor || 'vendedor'}.` : 'Define tu ubicación de lunes a viernes.'}</p></div>
    <form onSubmit={guardar} className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="mb-4 rounded-lg bg-navy-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Semana seleccionada</p><p className="mt-1 font-bold capitalize text-navy-500">{rangoDeSemana(semana)}</p><input aria-label="Seleccionar semana" type="date" value={semana} onChange={e => setSemana(inicioDeSemana(new Date(`${e.target.value}T12:00:00`)))} className="mt-2 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm" /></div>
      <div className="space-y-3">{filas.map((fila, index) => <div key={fila.dia} className="grid gap-2 sm:grid-cols-[110px_1fr_1fr]"><p className="py-2 text-sm font-bold text-navy-500">{DIAS_PLANIFICACION[index].nombre}</p><input readOnly={readOnly} required={!readOnly} placeholder="Ciudad o zona" value={fila.ubicacion} onChange={e => setFilas(prev => prev.map(item => item.dia === fila.dia ? { ...item, ubicacion: e.target.value } : item))} className="rounded-lg border border-navy-100 px-3 py-2 text-sm read-only:bg-navy-50" /><input readOnly={readOnly} placeholder="Notas (opcional)" value={fila.notas} onChange={e => setFilas(prev => prev.map(item => item.dia === fila.dia ? { ...item, notas: e.target.value } : item))} className="rounded-lg border border-navy-100 px-3 py-2 text-sm read-only:bg-navy-50" /></div>)}</div>
      {mensaje && <p className="mt-4 text-sm text-green-700">{mensaje}</p>}{error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {!readOnly && <button disabled={saving} className="mt-5 rounded-lg bg-primary-400 px-4 py-2.5 font-bold text-navy-500 disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar planificación'}</button>}
    </form>
    {readOnly && <HistorialPlanificacion vendedorId={vendedorId} semana={semana} />}
  </section>
}

export function HistorialPlanificacion({ vendedorId, semana }: { vendedorId: string; semana: string }) {
  const [historial, setHistorial] = useState<EdicionPlanificacion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { planificacionService.getHistorial(vendedorId, semana).then(setHistorial).catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.')) }, [vendedorId, semana])

  return <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-navy-500">Historial de ediciones</h3><p className="mt-1 text-xs text-navy-200">Cada guardado queda registrado para seguimiento.</p>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 space-y-3">{historial.map(version => <details key={version.id} className="rounded-lg bg-navy-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Versión {version.version} · {new Date(version.created_at).toLocaleString('es-EC')}<span className="ml-2 text-xs font-normal text-navy-200">Editó: {version.editado_por.slice(0, 8)}...</span></summary><div className="mt-3 grid gap-2 sm:grid-cols-5">{DIAS_PLANIFICACION.map(dia => { const fila = version.snapshot.find(item => item.dia === dia.dia); return <div key={dia.dia}><p className="text-xs font-bold text-navy-300">{dia.nombre}</p><p className="text-xs text-navy-500">{fila?.ubicacion || 'Sin asignar'}</p>{fila?.notas && <p className="text-xs text-navy-200">{fila.notas}</p>}</div> })}</div></details>)}{!historial.length && !error && <p className="mt-3 text-sm text-navy-200">Aún no hay ediciones registradas.</p>}</div></section>
}