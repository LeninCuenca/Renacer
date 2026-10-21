import { useState, useEffect } from 'react'
import { reporteService } from '../services/reporteService'
import LoadingView from '../components/ui/LoadingView'
import ErrorBox from '../components/ui/ErrorBox'

type Rango = 'dia' | 'semana' | 'mes'

export default function ProduccionScreen() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await reporteService.getReportePlantaData()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los datos de producción')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [exportingOrder, setExportingOrder] = useState<string | null>(null)

  const handleExportarOrden = async (ordenNum: string, items: any[], e: React.MouseEvent) => {
    e.stopPropagation() // Evitar que expanda la tarjeta
    setExportingOrder(ordenNum)
    setError(null)
    try {
      await reporteService.exportarDataPlanta(items, `Produccion_Orden_${ordenNum}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar orden')
    } finally {
      setExportingOrder(null)
    }
  }

  // Filtrar y luego agrupar
  const filteredData = data.filter(row => {
    const term = searchTerm.toLowerCase()
    return row.orden.toLowerCase().includes(term) || row.cliente.toLowerCase().includes(term)
  })

  const dataAgrupada = filteredData.reduce((acc, row) => {
    if (!acc[row.orden]) {
      acc[row.orden] = []
    }
    acc[row.orden].push(row)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-500">Reporte de Producción (Planta)</h2>
          <p className="text-sm text-navy-200">Visualiza el historial de llantas evaluadas agrupado por orden.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input 
          type="text" 
          placeholder="Buscar por número de orden o cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-navy-100 bg-white px-4 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none"
        />
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {loading ? (
        <LoadingView />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-navy-100 bg-white p-8 text-center text-sm font-medium text-navy-300">
          No hay registros de producción.
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.entries(dataAgrupada) as [string, any[]][]).map(([ordenNum, items]) => {
            const cliente = items[0].cliente
            const isExpanded = expandedOrder === ordenNum
            const isExporting = exportingOrder === ordenNum

            return (
              <div key={ordenNum} className="rounded-xl border border-navy-100 bg-white shadow-sm overflow-hidden">
                <div
                  onClick={() => setExpandedOrder(isExpanded ? null : ordenNum)}
                  className="w-full flex flex-wrap items-center justify-between p-4 text-left hover:bg-navy-50 transition cursor-pointer gap-4"
                >
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-bold text-navy-500 text-base">Orden N° {ordenNum}</h3>
                    <p className="text-sm text-navy-300">{cliente} · {items.length} llantas evaluadas</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => handleExportarOrden(ordenNum, items, e)}
                      disabled={exportingOrder !== null}
                      className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-xs font-bold text-navy-500 hover:bg-navy-50 shadow-sm disabled:opacity-50 transition"
                    >
                      {isExporting ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                    <div className="text-navy-300 font-bold text-xl px-2">
                      {isExpanded ? '−' : '+'}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-navy-100 overflow-x-auto bg-navy-50/20">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-navy-50 text-xs text-navy-400 border-b border-navy-100 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Fecha</th>
                          <th className="px-4 py-3 font-semibold">Item N°</th>
                          <th className="px-4 py-3 font-semibold">Marca</th>
                          <th className="px-4 py-3 font-semibold">Medida</th>
                          <th className="px-4 py-3 font-semibold">Serie</th>
                          <th className="px-4 py-3 font-semibold">Trabajo / Obs.</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-50">
                        {items.map((row: any, idx: number) => (
                          <tr key={row.id || idx} className="hover:bg-navy-50/50 transition">
                            <td className="px-4 py-3 text-navy-500">{row.fecha}</td>
                            <td className="px-4 py-3 text-center font-bold text-navy-500">{row.numero_llanta}</td>
                            <td className="px-4 py-3 text-navy-500">{row.marca}</td>
                            <td className="px-4 py-3 text-navy-500">{row.medida}</td>
                            <td className="px-4 py-3 text-navy-500">{row.serie}</td>
                            <td className="px-4 py-3 text-navy-400 truncate max-w-[200px]" title={row.observaciones}>{row.observaciones}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.estado === 'TERMINADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {row.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
