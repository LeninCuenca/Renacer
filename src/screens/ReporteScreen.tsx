import { useState, useEffect } from 'react'
import type { ResumenReporte } from '../types'
import { MESES } from '../types'
import { reporteService } from '../services/reporteService'
import StatCard from '../components/ui/StatCard'
import ErrorBox from '../components/ui/ErrorBox'
import { DownloadIcon } from '../components/icons'

export default function ReporteScreen() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarResumen = async () => {
    setLoading(true); setError(null)
    try {
      const data = await reporteService.getResumenMensual(anio, mes)
      setResumen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarResumen() }, [])

  const [descargando, setDescargando] = useState(false)

  const descargarExcel = async () => {
    if (descargando) return
    setDescargando(true); setError(null)
    try {
      await reporteService.exportarExcelMensual(anio, mes)
    } catch (e) {
      setError('Error al descargar Excel: ' + (e instanceof Error ? e.message : 'Error desconocido'))
    } finally {
      setDescargando(false)
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
              {MESES.map((nombre, i) => <option key={i + 1} value={i + 1}>{nombre}</option>)}
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
          <h3 className="mb-4 text-sm font-bold text-navy-500">Resumen {MESES[resumen.mes - 1]} {resumen.anio}</h3>
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

      <button onClick={descargarExcel} disabled={descargando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-400 px-4 py-3.5 text-sm font-bold text-navy-500 shadow-sm transition hover:bg-primary-300 active:scale-[0.99] disabled:opacity-60">
        <DownloadIcon /> {descargando ? 'Generando Excel...' : 'Descargar Excel por cliente'}
      </button>
    </div>
  )
}
