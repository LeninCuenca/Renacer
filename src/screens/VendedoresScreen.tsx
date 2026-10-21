import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import type { Perfil } from '../types'
import PlanificacionScreen from './PlanificacionScreen'

export default function VendedoresScreen() {
  const [vendedores, setVendedores] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionado, setSeleccionado] = useState<Perfil | null>(null)

  useEffect(() => {
    authService.getVendedores().then(setVendedores).catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo.')).finally(() => setLoading(false))
  }, [])

  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold text-navy-500">Vendedores</h2><p className="text-sm text-navy-200">Consulta el equipo comercial activo.</p></div>
    {loading && <p className="text-sm text-navy-200">Cargando vendedores...</p>}
    {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!loading && !error && <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
      {vendedores.map(vendedor => <button type="button" key={vendedor.id} onClick={() => setSeleccionado(vendedor)} className="flex w-full flex-col sm:flex-row sm:items-center justify-between border-b border-navy-50 px-5 py-4 text-left hover:bg-navy-50 last:border-0 gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-500 truncate">{vendedor.nombres || vendedor.nombre} {vendedor.apellidos || ''}</p>
          <p className="text-sm text-navy-200 truncate">{vendedor.correo}</p>
          <p className="text-xs text-navy-200 truncate">Cédula: {vendedor.cedula}</p>
        </div>
        <span className={`shrink-0 self-start sm:self-auto ${vendedor.activo ? 'rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 text-center min-w-max' : 'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 text-center min-w-max'}`}>
          {vendedor.activo ? 'Ver planificación' : 'Inactivo'}
        </span>
      </button>)}
      {vendedores.length === 0 && <p className="p-5 text-sm text-navy-200">No hay vendedores registrados.</p>}
    </div>}
    
    {seleccionado && (
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-navy-700/60 p-2 sm:p-4" onClick={() => setSeleccionado(null)}>
        <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setSeleccionado(null)} className="text-xl text-navy-300 hover:text-navy-500">×</button>
          </div>
          <PlanificacionScreen vendedorId={seleccionado.id} readOnly nombreVendedor={`${seleccionado.nombres || seleccionado.nombre} ${seleccionado.apellidos || ''}`} />
        </div>
      </div>
    )}
  </section>
}