import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import { DIAS_PLANIFICACION, inicioDeSemana, planificacionService, rangoDeSemana } from '../services/planificacionService'
import type { Perfil, PlanificacionSemanal } from '../types'
import { HistorialPlanificacion } from './PlanificacionScreen'

export default function PlanificacionesScreen() {
  const [vendedores, setVendedores] = useState<Perfil[]>([])
  const [planes, setPlanes] = useState<Record<string, PlanificacionSemanal[]>>({})
  const [semana, setSemana] = useState(inicioDeSemana())
  const [error, setError] = useState<string | null>(null)

  const cargar = async () => {
    try {
      const equipo = await authService.getVendedores(); setVendedores(equipo)
      const entries = await Promise.all(equipo.map(async vendedor => [vendedor.id, await planificacionService.getPorVendedor(vendedor.id, semana)] as const))
      setPlanes(Object.fromEntries(entries))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las planificaciones.') }
  }
  useEffect(() => { cargar() }, [semana])

  return <section className="space-y-5"><div><h2 className="text-xl font-bold text-navy-500">Planificaciones semanales</h2><p className="text-sm text-navy-200">Consulta de lunes a viernes la ruta completa de cada vendedor.</p></div><div className="rounded-lg bg-navy-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Semana seleccionada</p><p className="mt-1 font-bold capitalize text-navy-500">{rangoDeSemana(semana)}</p><input aria-label="Seleccionar semana" type="date" value={semana} onChange={e => setSemana(inicioDeSemana(new Date(`${e.target.value}T12:00:00`)))} className="mt-2 rounded-lg border border-navy-100 bg-white px-3 py-2" /></div>{error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="space-y-3">{vendedores.map(vendedor => <article key={vendedor.id} className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-navy-500">{vendedor.nombres || vendedor.nombre} {vendedor.apellidos || ''}</h3><div className="mt-3 grid gap-2 sm:grid-cols-5">{DIAS_PLANIFICACION.map(dia => { const plan = planes[vendedor.id]?.find(item => item.dia === dia.dia); return <div key={dia.dia} className="rounded-lg bg-navy-50 p-3"><p className="text-xs font-bold text-navy-300">{dia.nombre}</p><p className="mt-1 text-sm font-semibold text-navy-500">{plan?.ubicacion || 'Sin asignar'}</p>{plan?.notas && <p className="mt-1 text-xs text-navy-200">{plan.notas}</p>}</div> })}</div><div className="mt-4"><HistorialPlanificacion vendedorId={vendedor.id} semana={semana} /></div></article>)}{vendedores.length === 0 && <p className="rounded-xl bg-white p-5 text-sm text-navy-200">No hay vendedores activos.</p>}</div></section>
}