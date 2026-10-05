import { useState, useEffect, useCallback } from 'react'
import type { Cliente } from '../types'
import { DIRECCIONES } from '../types'
import { clienteService } from '../services/clienteService'
import Input from '../components/ui/Input'
import ErrorBox from '../components/ui/ErrorBox'
import LoadingView from '../components/ui/LoadingView'
import EmptyState from '../components/ui/EmptyState'

export default function ClientesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroDir, setFiltroDir] = useState<string>('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    try {
      const data = await clienteService.getClientes()
      setClientes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setNombre(''); setCedula(''); setTelefono(''); setDireccion('')
    setShowForm(true); setError(null)
  }

  const abrirEditar = (c: Cliente) => {
    setEditando(c)
    setNombre(c.nombre); setCedula(c.cedula)
    setTelefono(c.telefono || ''); setDireccion(c.direccion || '')
    setShowForm(true); setError(null)
  }

  const cancelar = () => {
    setShowForm(false); setEditando(null)
    setNombre(''); setCedula(''); setTelefono(''); setDireccion('')
    setError(null)
  }

  const validar = (): boolean => {
    if (!nombre.trim()) { setError('El nombre del cliente es obligatorio'); return false }
    if (!cedula.trim()) { setError('La cédula o RUC es obligatorio'); return false }
    const cedulaLimpia = cedula.trim().replace(/\s/g, '')
    if (!/^\d{10}$/.test(cedulaLimpia) && !/^\d{13}$/.test(cedulaLimpia)) {
      setError('Ingrese una cédula válida (10 dígitos) o un RUC válido (13 dígitos)'); return false
    }
    if (telefono.trim() && !/^[\d\s\-\+\(\)]{7,15}$/.test(telefono.trim())) {
      setError('El número de teléfono no es válido'); return false
    }
    return true
  }

  const guardar = async () => {
    if (!validar()) return
    const cedulaLimpia = cedula.trim().replace(/\s/g, '')
    setSaving(true); setError(null)
    try {
      if (editando) {
        await clienteService.updateCliente(editando.id, {
          nombre: nombre.trim(), cedula: cedulaLimpia,
          telefono: telefono || null, direccion: direccion || null,
        })
      } else {
        await clienteService.createCliente({ nombre: nombre.trim(), cedula: cedulaLimpia, telefono: telefono || null, direccion: direccion || null })
      }
      cancelar(); cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (c: Cliente) => {
    const nuevoEstado = !(c.activo !== false)
    const accion = nuevoEstado ? 'activar' : 'desactivar'
    if (!window.confirm(`¿Desea ${accion} al cliente "${c.nombre}"?`)) return
    try {
      await clienteService.toggleActivoCliente(c.id, nuevoEstado)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Error al ${accion}`)
    }
  }

  const clientesActivos = clientes.filter(c => c.activo !== false)
  const clientesInactivos = clientes.filter(c => c.activo === false)
  const q = busqueda.trim().toLowerCase()
  const clientesMostrados = (mostrarInactivos ? clientesInactivos : clientesActivos)
    .filter(c => filtroDir ? c.direccion === filtroDir : true)
    .filter(c => q === '' || c.nombre.toLowerCase().includes(q) || c.cedula.includes(q))
  const conteoDir = DIRECCIONES.map(d => ({
    direccion: d,
    count: clientesActivos.filter(c => c.direccion === d).length
  })).filter(d => d.count > 0)

  if (loading) return <LoadingView />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-500">Clientes</h2>
        <button onClick={abrirNuevo} className="rounded-lg bg-primary-400 px-4 py-2 text-sm font-bold text-navy-500 transition hover:bg-primary-300">
          + Nuevo
        </button>
      </div>

      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Buscador */}
      <div className="flex items-center rounded-xl border border-navy-100 bg-white px-3 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200">
        <svg className="mr-2 h-4 w-4 shrink-0 text-navy-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o cédula..."
          className="flex-1 bg-transparent py-2.5 text-sm text-navy-500 placeholder-navy-200 outline-none"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="ml-1 text-navy-300 hover:text-navy-500">✕</button>
        )}
      </div>

      {/* Formulario crear / editar */}
      {showForm && (
        <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy-500">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <button onClick={cancelar} className="text-sm text-navy-200 hover:text-navy-500">✕ Cancelar</button>
          </div>
          <Input label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Juan Perez" />
          <Input label="Cedula / RUC *" value={cedula} onChange={v => setCedula(v.replace(/\D/g, '').slice(0, 13))} placeholder="1700000000 o 1700000000001" type="tel" inputMode="numeric" pattern="[0-9]*" hint={cedula.length === 10 ? '✓ Cédula (10 dígitos)' : cedula.length === 13 ? '✓ RUC (13 dígitos)' : cedula.length > 0 ? `${cedula.length}/10 o 13 dígitos` : undefined} />
          <Input label="Telefono" value={telefono} onChange={setTelefono} placeholder="098 765 4321" type="tel" inputMode="numeric" pattern="[0-9]*" />
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Direccion</label>
            <select value={direccion} onChange={e => setDireccion(e.target.value)}
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200">
              <option value="">Seleccione...</option>
              {DIRECCIONES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={guardar} disabled={saving}
            className="mt-2 w-full rounded-lg bg-primary-400 px-4 py-3 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Tabs activos / inactivos */}
      <div className="flex gap-2">
        <button onClick={() => { setMostrarInactivos(false); setFiltroDir('') }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${!mostrarInactivos ? 'bg-navy-500 text-white' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
          Activos ({clientesActivos.length})
        </button>
        <button onClick={() => { setMostrarInactivos(true); setFiltroDir('') }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${mostrarInactivos ? 'bg-red-500 text-white' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
          Inactivos ({clientesInactivos.length})
        </button>
      </div>

      {!mostrarInactivos && conteoDir.length > 0 && (
        <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-primary-600">Conteo por direccion</h3>
          <div className="flex flex-wrap gap-2">
            {conteoDir.map(d => (
              <button key={d.direccion} onClick={() => setFiltroDir(filtroDir === d.direccion ? '' : d.direccion)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filtroDir === d.direccion ? 'bg-primary-400 text-navy-500' : 'bg-navy-50 text-navy-400 hover:bg-navy-100'}`}>
                {d.direccion} ({d.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {filtroDir && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-navy-400">Filtrando por:</span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 font-bold text-navy-500">{filtroDir}</span>
          <button onClick={() => setFiltroDir('')} className="text-navy-200 hover:text-red-500">✕ quitar</button>
        </div>
      )}

      {clientesMostrados.length === 0 ? (
        <EmptyState text={mostrarInactivos ? 'No hay clientes inactivos' : 'No hay clientes registrados'} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clientesMostrados.map(c => (
            <div key={c.id} className={`rounded-xl border bg-white p-4 shadow-sm ${c.activo === false ? 'border-red-100 opacity-70' : 'border-navy-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-navy-500">{c.nombre}</p>
                    {c.activo === false && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">INACTIVO</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-navy-300">Cédula/RUC: {c.cedula}</p>
                  {c.telefono && <p className="text-xs text-navy-300">Tel: {c.telefono}</p>}
                  {c.direccion && <p className="mt-1.5 inline-block rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-400">{c.direccion}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => abrirEditar(c)}
                    className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[11px] font-bold text-navy-500 hover:bg-primary-100 transition">
                    ✏️ Editar
                  </button>
                  <button onClick={() => toggleActivo(c)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${c.activo === false ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {c.activo === false ? '✓ Activar' : '⊘ Desactivar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
