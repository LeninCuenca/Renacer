import { useEffect, useState } from 'react'
import { ordenService } from '../services/ordenService'
import type { Orden } from '../types'
import { formatCurrency, formatFecha } from '../services/helpers'

export default function CarteraScreen() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabCartera, setTabCartera] = useState<'facturar' | 'cobrar'>('facturar')

  useEffect(() => {
    ordenService.getOrdenes()
      .then(setOrdenes)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar cartera'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="py-8 text-center text-sm text-navy-200">Cargando módulo de cartera...</p>
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>

  // Órdenes en retorno de fábrica (para facturar)
  const paraFacturar = ordenes.filter(o => o.estado === 'Retorno de fabrica')
  // Órdenes con montos pendientes de cobro (Cartera activa)
  const paraCobrar = ordenes.filter(o => o.monto_pendiente > 0)
  
  const totalCartera = paraCobrar.reduce((acc, o) => acc + (o.monto_pendiente || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-500">Módulo de Contabilidad</h2>
        <p className="text-sm text-navy-200">Gestión de facturación y cartera de clientes.</p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-navy-200 font-medium">Total Cartera (Pendiente de cobro)</p>
          <p className="text-2xl font-bold text-amber-500">{formatCurrency(totalCartera)}</p>
        </div>
        <div className="flex-1 min-w-[200px] border-l border-navy-50 pl-4">
          <p className="text-xs text-navy-200 font-medium">Órdenes a Facturar (Retorno de Fábrica)</p>
          <p className="text-2xl font-bold text-orange-500">{paraFacturar.length}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-navy-100 pb-2">
        <button
          onClick={() => setTabCartera('facturar')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tabCartera === 'facturar'
              ? 'bg-orange-50 text-orange-600'
              : 'text-navy-300 hover:bg-navy-50'
          }`}
        >
          Para Facturar ({paraFacturar.length})
        </button>
        <button
          onClick={() => setTabCartera('cobrar')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tabCartera === 'cobrar'
              ? 'bg-amber-50 text-amber-600'
              : 'text-navy-300 hover:bg-navy-50'
          }`}
        >
          Cartera por Cobrar ({paraCobrar.length})
        </button>
      </div>

      {tabCartera === 'facturar' && (
        <div className="space-y-4">
          {paraFacturar.length === 0 ? (
            <p className="text-sm text-navy-200 py-4">No hay órdenes pendientes de facturación (en retorno de fábrica).</p>
          ) : (
            paraFacturar.map(orden => (
              <div key={orden.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-navy-50 pb-3">
                  <div>
                    <h3 className="font-bold text-navy-500">{orden.numero}</h3>
                    <p className="text-xs text-navy-200">{orden.cliente_nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-navy-200">Fecha de retorno:</p>
                    <p className="text-sm font-medium text-navy-500">
                      {orden.fecha_rf ? formatFecha(orden.fecha_rf) : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-xs font-semibold text-navy-400 mb-2">Detalle de items para facturación:</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-navy-50 text-navy-300">
                        <tr>
                          <th className="p-2 font-medium">Cant.</th>
                          <th className="p-2 font-medium">Detalle (Medida/Diseño/Marca)</th>
                          <th className="p-2 font-medium">V. Unitario</th>
                          <th className="p-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-50">
                        {orden.items?.map((item, idx) => (
                          <tr key={idx} className={item.rechazo ? 'bg-red-50/30' : ''}>
                            <td className="p-2">{item.cantidad}</td>
                            <td className="p-2 truncate max-w-[200px]">
                              <span className={item.rechazo ? 'line-through text-navy-300' : ''}>
                                {[item.media, item.diseno, item.marca].filter(Boolean).join(' - ') || 'Llanta'}
                              </span>
                              {item.rechazo && <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Rechazada</span>}
                            </td>
                            <td className="p-2">
                              <span className={item.rechazo ? 'line-through text-navy-300' : ''}>
                                {formatCurrency(item.valor_unitario)}
                              </span>
                            </td>
                            <td className="p-2 font-medium">
                              {item.rechazo ? (
                                <span className="text-red-500 font-bold">$0.00</span>
                              ) : (
                                <span>{formatCurrency(item.cantidad * item.valor_unitario)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex justify-between items-center rounded-lg bg-orange-50 p-3">
                  <span className="text-sm font-semibold text-orange-800">Total a Facturar:</span>
                  <span className="text-lg font-bold text-orange-600">{formatCurrency(orden.monto_total)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tabCartera === 'cobrar' && (
        <div className="space-y-4">
          {paraCobrar.length === 0 ? (
            <p className="text-sm text-navy-200 py-4">No hay cuentas por cobrar en este momento.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-navy-100 bg-navy-50 text-xs text-navy-300">
                  <tr>
                    <th className="p-4 font-semibold">Orden</th>
                    <th className="p-4 font-semibold">Cliente</th>
                    <th className="p-4 font-semibold">Vencimiento</th>
                    <th className="p-4 font-semibold text-right">Total</th>
                    <th className="p-4 font-semibold text-right">Abonado</th>
                    <th className="p-4 font-semibold text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {paraCobrar.map(orden => (
                    <tr key={orden.id} className="hover:bg-navy-50/50">
                      <td className="p-4 font-medium text-navy-500">{orden.numero}</td>
                      <td className="p-4 text-navy-400">{orden.cliente_nombre}</td>
                      <td className="p-4 text-navy-400">
                        {orden.fecha_vencimiento ? (
                          <span className={new Date(orden.fecha_vencimiento) < new Date() ? 'text-red-500 font-medium' : ''}>
                            {formatFecha(orden.fecha_vencimiento)}
                          </span>
                        ) : (
                          <span className="text-xs italic text-navy-200">No definido</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-medium text-navy-500">{formatCurrency(orden.monto_total)}</td>
                      <td className="p-4 text-right text-emerald-600">{formatCurrency(orden.monto_abonado)}</td>
                      <td className="p-4 text-right font-bold text-amber-500">{formatCurrency(orden.monto_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
