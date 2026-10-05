import { useEffect, useState } from 'react'
import { ordenService } from '../services/ordenService'
import { authService } from '../services/authService'
import StatCard from '../components/ui/StatCard'
import type { Orden, Perfil } from '../types'
import type { Rol } from '../types'

export default function DashboardScreen({ rol }: { rol: Rol }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([ordenService.getOrdenes(true), rol === 'jefe' ? authService.getUsuarios() : Promise.resolve([] as Perfil[])])
      .then(([ordenesData, usuariosData]) => { setOrdenes(ordenesData); setUsuarios(usuariosData) })
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard.'))
      .finally(() => setLoading(false))
  }, [rol])

  if (loading) return <p className="py-8 text-center text-sm text-navy-200">Cargando dashboard...</p>
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>

  const pendientes = ordenes.filter(orden => orden.monto_pendiente > 0).length
  const entregadas = ordenes.filter(orden => orden.estado === 'Entregado al cliente').length
  const totalPendiente = ordenes.reduce((total, orden) => total + Math.max(orden.monto_pendiente, 0), 0)
  const totalOrdenado = ordenes.reduce((total, orden) => total + Math.max(orden.monto_total, 0), 0)
  const totalAbonado = ordenes.reduce((total, orden) => total + Math.max(orden.monto_abonado, 0), 0)
  const vendedores = usuarios.filter(usuario => usuario.rol === 'vendedor')
  const estados = [
    { nombre: 'Recepción', clave: 'Recepcion', color: 'bg-sky-500' },
    { nombre: 'Envío a fábrica', clave: 'Envio a fabrica', color: 'bg-amber-400' },
    { nombre: 'Retorno de fábrica', clave: 'Retorno de fabrica', color: 'bg-orange-500' },
    { nombre: 'En bodega', clave: 'En bodega', color: 'bg-indigo-500' },
    { nombre: 'Entregadas', clave: 'Entregado al cliente', color: 'bg-emerald-500' },
  ].map(estado => ({ ...estado, cantidad: ordenes.filter(orden => orden.estado === estado.clave).length }))
  const maxEstado = Math.max(...estados.map(estado => estado.cantidad), 1)
  const actividad = [1, 2, 3, 4, 5].map((dia, index) => ({ nombre: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][index], cantidad: ordenes.filter(orden => { const fecha = orden.created_at ? new Date(orden.created_at) : null; const diaOrden = fecha ? (fecha.getDay() || 7) : 0; return diaOrden === dia }).length }))
  const maxActividad = Math.max(...actividad.map(dia => dia.cantidad), 1)
  const porcentajePagado = totalOrdenado > 0 ? Math.round((totalAbonado / totalOrdenado) * 100) : 0

  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold text-navy-500">Dashboard</h2><p className="text-sm text-navy-200">Resumen general de la operación.</p></div>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Órdenes" value={String(ordenes.length)} />
      <StatCard label="Pendientes de pago" value={String(pendientes)} />
      <StatCard label="Entregadas" value={String(entregadas)} />
      <StatCard label="Vendedores" value={String(vendedores.length)} />
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h3 className="text-sm font-bold text-navy-500">Órdenes por estado</h3><p className="text-xs text-navy-200">Flujo actual de trabajo</p></div><span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-400">{ordenes.length} total</span></div>
        <div className="space-y-4">{estados.map(estado => <div key={estado.clave}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-navy-400">{estado.nombre}</span><span className="font-bold text-navy-500">{estado.cantidad}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-navy-50"><div className={`h-full rounded-full ${estado.color} transition-all`} style={{ width: `${(estado.cantidad / maxEstado) * 100}%` }} /></div></div>)}</div>
      </div>
      <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <div className="mb-5"><h3 className="text-sm font-bold text-navy-500">Cartera financiera</h3><p className="text-xs text-navy-200">Total facturado frente a lo recaudado</p></div>
        <div className="flex items-center gap-5"><div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(#10b981 ${porcentajePagado}%, #fbbf24 ${porcentajePagado}% 100%)` }}><div className="absolute inset-4 flex items-center justify-center rounded-full bg-white"><span className="text-xl font-bold text-navy-500">{porcentajePagado}%</span></div></div><div className="space-y-3 text-sm"><div><p className="text-xs text-navy-200">Recaudado</p><p className="font-bold text-emerald-600">${totalAbonado.toFixed(2)}</p></div><div><p className="text-xs text-navy-200">Pendiente</p><p className="font-bold text-amber-500">${totalPendiente.toFixed(2)}</p></div><div><p className="text-xs text-navy-200">Total</p><p className="font-bold text-navy-500">${totalOrdenado.toFixed(2)}</p></div></div></div>
      </div>
    </section>
    <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between"><div><h3 className="text-sm font-bold text-navy-500">Actividad semanal</h3><p className="text-xs text-navy-200">Órdenes creadas por día</p></div><span className="text-xs text-navy-200">Lunes a viernes</span></div>
      <div className="flex h-44 items-end justify-around gap-3 border-b border-navy-100 px-2">{actividad.map(dia => <div key={dia.nombre} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-bold text-navy-400">{dia.cantidad || ''}</span><div className="w-full max-w-12 rounded-t-lg bg-primary-400 transition-all" style={{ height: `${Math.max((dia.cantidad / maxActividad) * 100, dia.cantidad ? 8 : 2)}%` }} /><span className="text-xs font-semibold text-navy-300">{dia.nombre}</span></div>)}</div>
    </section>
    <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-navy-500">Últimas órdenes</h3><span className="text-xs text-navy-200">{ordenes.length} registradas</span></div>
      <div className="space-y-2">
        {ordenes.slice(0, 5).map(orden => <div key={orden.id} className="flex items-center justify-between border-b border-navy-50 py-2 last:border-0"><div><p className="text-sm font-semibold text-navy-500">{orden.numero}</p><p className="text-xs text-navy-200">{orden.cliente_nombre || 'Sin cliente'}</p></div><span className="text-xs font-semibold text-navy-400">{orden.estado}</span></div>)}
        {ordenes.length === 0 && <p className="text-sm text-navy-200">Todavía no hay órdenes.</p>}
      </div>
    </section>
  </section>
}