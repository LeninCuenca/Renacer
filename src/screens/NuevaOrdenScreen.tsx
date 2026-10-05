import { useState, useEffect } from 'react'
import type { Cliente, Item } from '../types'
import { MEDIDAS_LLANTAS } from '../types'
import { clienteService } from '../services/clienteService'
import { ordenService } from '../services/ordenService'
import ClienteSearchSelect from '../components/ClienteSearchSelect'
import ItemField from '../components/ItemField'
import Input from '../components/ui/Input'
import ErrorBox from '../components/ui/ErrorBox'
import { ChevronIcon, TrashIcon } from '../components/icons'

export default function NuevaOrdenScreen({ onCreated }: { onCreated: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<number>(0)
  const [numero, setNumero] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)

  // Campos del formulario temporal
  const [fMarca, setFMarca] = useState('')
  const [fSerie, setFSerie] = useState('')
  const [fMedia, setFMedia] = useState('')
  const [fDiseno, setFDiseno] = useState('')
  const [fCantidad, setFCantidad] = useState(1)
  const [fValor, setFValor] = useState(0)
  const [fObs, setFObs] = useState('')
  const [fRechazo, setFRechazo] = useState(false)

  useEffect(() => {
    clienteService.getClientes()
      .then(data => setClientes(data.filter(c => c.activo !== false)))
      .catch(() => {})
  }, [])

  const limpiarFormulario = () => {
    setFMarca(''); setFSerie(''); setFMedia(''); setFDiseno('')
    setFCantidad(1); setFValor(0); setFObs(''); setFRechazo(false)
  }

  const agregarLlanta = () => {
    if (!fMarca.trim() && !fMedia) { setError('Ingrese al menos la marca o la medida'); return }
    const nuevo: Item = {
      marca: fMarca || null, n_serie: fSerie || null,
      media: fMedia || null, diseno: fDiseno || null,
      cantidad: fCantidad, valor_unitario: fValor,
      rechazo: fRechazo, observaciones: fObs,
    }
    setItems(prev => [...prev, nuevo])
    limpiarFormulario()
    setListaAbierta(true)
    setError(null)
  }

  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const toggleRechazo = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, rechazo: !it.rechazo } : it))
  }

  const totalEstimado = items.filter(it => !it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)
  const totalRechazado = items.filter(it => it.rechazo).reduce((sum, it) => sum + it.cantidad * it.valor_unitario, 0)

  const guardar = async () => {
    if (!clienteId || !numero.trim()) { setError('Seleccione cliente e ingrese numero de orden'); return }
    if (items.length === 0) { setError('Agregue al menos una llanta'); return }
    setSaving(true); setError(null)
    try {
      await ordenService.createOrden({
        numero, cliente_id: clienteId, observaciones,
        items: items.map(it => ({
          marca: it.marca || null, n_serie: it.n_serie || null,
          media: it.media || null, diseno: it.diseno || null,
          cantidad: it.cantidad, valor_unitario: it.valor_unitario,
          rechazo: it.rechazo, observaciones: it.observaciones,
        })),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear orden')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-navy-500">Nueva Orden de Trabajo</h2>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-navy-500">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">1</span>
          Datos Generales
        </h3>
        <ClienteSearchSelect
          clientes={clientes}
          clienteId={clienteId}
          onSelect={setClienteId}
        />
        <Input label="Numero de orden *" value={numero} onChange={setNumero} placeholder="OT-0001" />
        <Input label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas..." multiline />
      </section>

      {/* Formulario para agregar una llanta */}
      <section className="rounded-xl border border-navy-100 bg-white shadow-sm">
        <div className="border-b border-navy-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-navy-500">2</span>
            Registrar llanta
          </h3>
          <p className="mt-1 text-xs text-navy-300">Llene los datos y toque "Agregar llanta" para anadirla a la lista.</p>
        </div>

        <div className="space-y-2.5 p-5">
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Marca">
              <input value={fMarca} onChange={e => setFMarca(e.target.value)} placeholder="Ej: Michelin" className="item-input" />
            </ItemField>
            <ItemField label="N° Serie">
              <input value={fSerie} onChange={e => setFSerie(e.target.value)} placeholder="Ej: SN-0001" className="item-input" />
            </ItemField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Medida">
              <select value={fMedia} onChange={e => setFMedia(e.target.value)} className="item-input">
                <option value="">Seleccionar...</option>
                {MEDIDAS_LLANTAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </ItemField>
            <ItemField label="Diseño">
              <input value={fDiseno} onChange={e => setFDiseno(e.target.value)} placeholder="Ej: Rayado" className="item-input" />
            </ItemField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ItemField label="Cantidad">
              <input type="number" min="1" value={String(fCantidad)} onChange={e => setFCantidad(parseInt(e.target.value) || 1)} className="item-input" />
            </ItemField>
            <ItemField label="Valor unitario ($)">
              <input type="number" min="0" step="0.01" value={String(fValor)} onChange={e => setFValor(parseFloat(e.target.value) || 0)} className="item-input" />
            </ItemField>
          </div>
          <ItemField label="Observaciones">
            <input value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Notas sobre esta llanta..." className="item-input" />
          </ItemField>

          <button onClick={() => setFRechazo(!fRechazo)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition ${
              fRechazo
                ? 'border-red-200 bg-red-100 text-red-700 hover:bg-red-50'
                : 'border-navy-100 bg-navy-50 text-navy-400 hover:border-red-200 hover:text-red-500'
            }`}>
            {fRechazo ? '✓ Marcada como rechazada — toca para quitar' : 'Marcar como rechazada (no se cobra)'}
          </button>

          <button onClick={agregarLlanta}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-navy-600 active:scale-95">
            <span className="text-base leading-none">+</span> Agregar llanta
          </button>
        </div>
      </section>

      {/* Lista desplegable de llantas agregadas */}
      {items.length > 0 && (
        <section className="rounded-xl border border-navy-100 bg-white shadow-sm">
          <button onClick={() => setListaAbierta(!listaAbierta)}
            className="flex w-full items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-navy-500">Llantas agregadas</h3>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-navy-500">{items.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
              <span className={`text-navy-300 transition-transform ${listaAbierta ? 'rotate-180' : ''}`}>
                <ChevronIcon />
              </span>
            </div>
          </button>

          {listaAbierta && (
            <div className="divide-y divide-navy-50 border-t border-navy-100">
              {items.map((it, idx) => {
                const subtotal = it.cantidad * it.valor_unitario
                return (
                  <div key={idx} className={`px-5 py-3 ${it.rechazo ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[10px] font-extrabold text-navy-500">
                          {idx + 1}
                        </span>
                        <div>
                          <p className={`text-sm font-bold ${it.rechazo ? 'text-red-400 line-through' : 'text-navy-500'}`}>
                            {it.cantidad}x {it.marca || 'Sin marca'} — {it.media || 'S/M'}
                          </p>
                          <p className="text-xs text-navy-300">
                            {it.n_serie ? `Serie: ${it.n_serie} · ` : ''}{it.diseno ? `Diseño: ${it.diseno}` : ''}
                          </p>
                          {it.observaciones && <p className="text-xs text-navy-300">Obs: {it.observaciones}</p>}
                          {it.rechazo && <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RECHAZADA</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-sm font-bold ${it.rechazo ? 'text-red-300 line-through' : 'text-navy-500'}`}>${subtotal.toFixed(2)}</span>
                        <button onClick={() => toggleRechazo(idx)}
                          className={`rounded px-2 py-1 text-[10px] font-bold transition ${it.rechazo ? 'bg-green-100 text-green-700 hover:bg-green-50' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                          {it.rechazo ? 'Activar' : 'Rechazar'}
                        </button>
                        <button onClick={() => quitarItem(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-navy-200 transition hover:bg-red-50 hover:text-red-500">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Totales */}
              <div className="space-y-1 bg-navy-50/50 px-5 py-4">
                {totalRechazado > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400">Rechazado (no se cobra):</span>
                    <span className="font-bold text-red-400 line-through">${totalRechazado.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy-400">Total a cobrar:</span>
                  <span className="text-lg font-extrabold text-navy-500">${totalEstimado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <button onClick={guardar} disabled={saving}
        className="w-full rounded-xl bg-primary-400 px-4 py-3.5 text-sm font-bold text-navy-500 shadow-sm transition hover:bg-primary-300 active:scale-[0.99] disabled:opacity-60">
        {saving ? 'Guardando...' : 'Crear Orden'}
      </button>
    </div>
  )
}
