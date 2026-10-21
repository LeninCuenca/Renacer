import { useState, useEffect, useRef } from 'react'
import type { Orden, EstadoOrden, TipoPago, Rol, Perfil } from '../types'
import { ESTADOS, TIPOS_PAGO, diasDeCredito, calcularFechaVencimiento } from '../types'
import { ordenService } from '../services/ordenService'
import { abonoService } from '../services/abonoService'
import { authService } from '../services/authService'
import { reporteService } from '../services/reporteService'
import EstadoBadge from '../components/EstadoBadge'
import PagoRow from '../components/ui/PagoRow'
import { CalendarIcon } from '../components/icons'

export default function OrdenDetalleModal({ orden: ordenInicial, rol, onOrdenActualizada, onClose }: { orden: Orden; rol: Rol; onOrdenActualizada: (o: Orden) => void; onClose: () => void }) {
  const [orden, setOrden] = useState<Orden>(ordenInicial)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [tipoPago, setTipoPago] = useState<string>(ordenInicial.tipo_pago || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [fechaVencPreview, setFechaVencPreview] = useState<string | null>(ordenInicial.fecha_vencimiento || null)
  const [historialAbonos, setHistorialAbonos] = useState<any[]>([])
  const [loadingAbonos, setLoadingAbonos] = useState(true)
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<Perfil[]>([])
  const [reasignando, setReasignando] = useState(false)
  const [selectedReasignarId, setSelectedReasignarId] = useState<string>('')
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [numeroFacturaInput, setNumeroFacturaInput] = useState(ordenInicial.numero_factura || '')
  const [generandoFactura, setGenerandoFactura] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const generarFactura = async () => {
    setGenerandoFactura(true)
    setMsg(null)
    try {
      const actualizada = await ordenService.emitirFactura(orden.id, numeroFacturaInput)
      setOrden(actualizada)
      onOrdenActualizada(actualizada)
      setMsgType('success')
      setMsg('✓ Factura generada correctamente. La orden ya puede ser enviada a Bodega o entregada al cliente.')
    } catch (err: any) {
      setMsgType('error')
      setMsg(err.message || 'Error al generar la factura')
    } finally {
      setGenerandoFactura(false)
    }
  }

  // Cargar historial de abonos
  const cargarAbonos = async () => {
    try {
      const data = await abonoService.getAbonos(orden.id)
      setHistorialAbonos(data)
    } catch (_) {}
    finally { setLoadingAbonos(false) }
  }

  useEffect(() => { cargarAbonos() }, [])
  useEffect(() => { ordenService.getEvaluaciones(orden.id).then(setEvaluaciones).catch(() => {}) }, [orden.id])
  useEffect(() => {
    if (rol === 'supervisor' || rol === 'jefe') {
      authService.getVendedoresYSupervisores().then(setVendedores).catch(() => {})
    }
  }, [rol])

  const puedeEntregar = (orden.estado === 'En bodega' || orden.estado === 'Retorno de fabrica') && orden.pagado_completo
  const bloqueadoPorPago = (orden.estado === 'En bodega' || orden.estado === 'Retorno de fabrica') && !orden.pagado_completo
  const esperandoPlanta = orden.estado === 'Envio a fabrica' && rol !== 'administrador_planta'

  const cancelarOrden = async () => {
    setSaving(true); setMsg(null)
    try {
      const ordenActualizada = await ordenService.updateOrdenEstado(orden.id, 'Cancelada')
      setOrden(ordenActualizada)
      onOrdenActualizada(ordenActualizada)
      setMsgType('success')
      setMsg('✓ Orden cancelada correctamente')
      setConfirmCancelar(false)
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const reasignarVendedor = async (nuevoVendedorId: string) => {
    if (!nuevoVendedorId || nuevoVendedorId === orden.vendedor_id) return
    if (!orden.vendedor_id) {
      setMsgType('error')
      setMsg('Esta orden no tiene un responsable asignado actualmente.')
      return
    }
    
    setReasignando(true); setMsg(null)
    try {
      await ordenService.reasignarVendedorMasivo(orden.vendedor_id, nuevoVendedorId)
      setMsgType('success')
      setMsg('✓ Todas las órdenes reasignadas correctamente. Cierre y recargue para ver los cambios.')
      // Actualizamos solo esta orden en UI localmente para no romperla
      const v = vendedores.find(x => x.id === nuevoVendedorId)
      const vNombre = v ? `${v.nombres || v.nombre} ${v.apellidos || ''}`.trim() : null
      const ordenOpt: Orden = { ...orden, vendedor_id: nuevoVendedorId, vendedor_nombre: vNombre }
      setOrden(ordenOpt)
      onOrdenActualizada(ordenOpt) // Esto disparará una actualización en OrdenesScreen, que al estar invalidado el caché, forzará recarga (si lo tenemos así).
      setSelectedReasignarId('')
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error al reasignar responsable')
    } finally {
      setReasignando(false)
    }
  }

  const cambiarEstado = async (estado: EstadoOrden) => {
    setSaving(true); setMsg(null)
    try {
      const ordenActualizada = await ordenService.updateOrdenEstado(orden.id, estado)
      setOrden(ordenActualizada)
      onOrdenActualizada(ordenActualizada)
      setMsgType('success')
      setMsg(`✓ Estado cambiado a: ${estado}`)
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const registrarAbono = async () => {
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0) { setMsgType('error'); setMsg('Ingrese un monto valido'); return }
    if (orden.monto_total <= 0) { setMsgType('error'); setMsg('Esta orden no tiene ítems con valor'); return }
    if (monto > orden.monto_pendiente + 0.01) {
      setMsgType('error'); setMsg(`El abono ($${monto.toFixed(2)}) excede el pendiente ($${orden.monto_pendiente.toFixed(2)})`); return
    }

    // ── Actualización optimista: UI cambia ANTES de esperar al servidor ──
    const nuevoAbonado = Math.round((orden.monto_abonado + monto) * 100) / 100
    const nuevoPendiente = Math.round((orden.monto_total - nuevoAbonado) * 100) / 100
    const nuevoPagado = nuevoPendiente <= 0 && orden.monto_total > 0
    const abonoOptimista = { id: `opt-${Date.now()}`, monto, fecha: new Date().toISOString() }
    const ordenOptimista: Orden = { ...orden, monto_abonado: nuevoAbonado, monto_pendiente: nuevoPendiente, pagado_completo: nuevoPagado }
    setOrden(ordenOptimista)
    onOrdenActualizada(ordenOptimista)
    setHistorialAbonos(prev => [abonoOptimista, ...prev])
    setAbonoMonto('')
    setMsgType('success')
    setMsg(`✓ Abono de $${monto.toFixed(2)} registrado`)

    // ── Confirma con la BD en segundo plano ──
    setSaving(true)
    try {
      const { abono, orden: ordenReal } = await abonoService.createAbono({
        orden_id: orden.id, monto,
        _montoTotal: orden.monto_total,
        _montoPendiente: orden.monto_pendiente,
      })
      // Reemplazar abono optimista con el real y actualizar orden confirmada
      setHistorialAbonos(prev => [abono, ...prev.filter(a => a.id !== abonoOptimista.id)])
      setOrden(ordenReal)
      onOrdenActualizada(ordenReal)
    } catch (e) {
      // Revertir si falló
      setOrden(orden)
      onOrdenActualizada(orden)
      setHistorialAbonos(prev => prev.filter(a => a.id !== abonoOptimista.id))
      setAbonoMonto(String(monto))
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error al registrar abono')
    } finally {
      setSaving(false)
    }
  }

  const definirPago = async () => {
    if (!tipoPago) return
    setSaving(true); setMsg(null)
    try {
      const actualizada = await ordenService.setPagoPago(orden.id, tipoPago as TipoPago)
      setFechaVencPreview(actualizada.fecha_vencimiento || null)
      setMsgType('success')
      const dias = diasDeCredito(tipoPago)
      if (dias > 0 && actualizada.fecha_vencimiento) {
        setMsg(`Credito a ${dias} dias. Vence el ${new Date(actualizada.fecha_vencimiento).toLocaleDateString('es-EC')}`)
      } else {
        setMsg(`Tipo de pago: ${tipoPago}`)
      }
      onClose()
    } catch (e) {
      setMsgType('error')
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  // Calcular preview de vencimiento al cambiar tipo de pago
  const onTipoPagoChange = (val: string) => {
    setTipoPago(val)
    const dias = diasDeCredito(val)
    if (dias > 0) {
      const fecha = calcularFechaVencimiento(new Date(), dias)
      setFechaVencPreview(fecha.toISOString())
    } else {
      setFechaVencPreview(null)
    }
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-navy-500">Orden {orden.numero}</h3>
          <button onClick={onClose} className="text-lg text-navy-200 hover:text-navy-500">✕</button>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg px-3 py-2 text-xs font-medium ${msgType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        <p className="text-sm font-semibold text-navy-400">{orden.cliente_nombre}</p>
        {orden.vendedor_nombre && <p className="text-xs text-navy-300 mt-0.5 mb-2">Responsable: {orden.vendedor_nombre}</p>}
        <div className="mt-2"><EstadoBadge estado={orden.estado} /></div>

        {/* Acciones de Supervisor */}
        {(rol === 'supervisor' || rol === 'jefe') && orden.estado !== 'Cancelada' && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50/50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-red-600">Acciones Administrativas</h4>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-navy-400">Reasignar Responsable</label>
                <div className="flex flex-col gap-2">
                  <select 
                    className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    onChange={e => setSelectedReasignarId(e.target.value)}
                    disabled={reasignando}
                    value={selectedReasignarId || orden.vendedor_id || ''}
                  >
                    <option value="" disabled>Seleccione un vendedor...</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombres || v.nombre} {v.apellidos || ''}</option>)}
                  </select>
                  
                  {selectedReasignarId && selectedReasignarId !== orden.vendedor_id && (
                    <div className="animate-fade-in mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-sm">
                      <p className="mb-2 text-xs font-semibold text-amber-800">¿Confirmar reasignación MASIVA? Esto pasará TODAS las órdenes del vendedor actual al nuevo seleccionado.</p>
                      <div className="flex gap-2">
                        <button onClick={() => reasignarVendedor(selectedReasignarId)} disabled={reasignando} className="flex-1 rounded bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600 transition">Sí, Reasignar</button>
                        <button onClick={() => setSelectedReasignarId('')} disabled={reasignando} className="flex-1 rounded border border-amber-200 bg-white py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                {!confirmCancelar ? (
                  <button onClick={() => setConfirmCancelar(true)} disabled={saving}
                    className="w-full rounded-lg bg-red-100 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-200">
                    {saving ? 'Procesando...' : 'Cancelar Orden de Trabajo'}
                  </button>
                ) : (
                  <div className="animate-fade-in rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold text-red-700">¿Está seguro de que desea cancelar esta orden? Esta acción no se puede deshacer.</p>
                    <div className="flex gap-2">
                      <button onClick={cancelarOrden} disabled={saving} className="flex-1 rounded bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 transition">Sí, Cancelar</button>
                      <button onClick={() => setConfirmCancelar(false)} disabled={saving} className="flex-1 rounded border border-red-200 bg-white py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition">No, Volver</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trazabilidad */}
        {rol !== 'contador' && (
          <>
            <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Trazabilidad operativa</h4>
            <div className="space-y-1.5">
              {/* Paso 1: Recepción */}
              {(() => {
                const completado = ['Recepcion', 'Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente'].includes(orden.estado)
                return (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${completado ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${completado ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                        {completado ? '✓' : '1'}
                      </span>
                      <span className={completado ? 'font-bold text-green-700' : 'text-gray-400'}>Recepción</span>
                    </div>
                    <span className="text-xs text-navy-300">
                      {orden.fecha_rc ? new Date(orden.fecha_rc).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'}
                    </span>
                  </div>
                )
              })()}

              {/* Paso 2: Envío a fábrica */}
              {(() => {
                const completado = ['Envio a fabrica', 'Retorno de fabrica', 'En bodega', 'Entregado al cliente'].includes(orden.estado)
                return (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${completado ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${completado ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                        {completado ? '✓' : '2'}
                      </span>
                      <span className={completado ? 'font-bold text-green-700' : 'text-gray-400'}>Envío a fábrica</span>
                    </div>
                    <span className="text-xs text-navy-300">
                      {orden.fecha_ef ? new Date(orden.fecha_ef).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'}
                    </span>
                  </div>
                )
              })()}

              {/* Paso 3: Retorno de fábrica */}
              {(() => {
                const completado = ['Retorno de fabrica', 'En bodega', 'Entregado al cliente'].includes(orden.estado)
                return (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${completado ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${completado ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                        {completado ? '✓' : '3'}
                      </span>
                      <span className={completado ? 'font-bold text-green-700' : 'text-gray-400'}>Retorno de fábrica</span>
                    </div>
                    <span className="text-xs text-navy-300">
                      {orden.fecha_rf ? new Date(orden.fecha_rf).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'}
                    </span>
                  </div>
                )
              })()}

              {/* Paso 4: Bodega o Entregado al cliente (Unificado) */}
              {(() => {
                const esEntregado = orden.estado === 'Entregado al cliente'
                const esBodega = orden.estado === 'En bodega'
                const paso4Listo = esEntregado || esBodega

                let etiqueta = 'Bodega o Entrega al cliente'
                let fechaTexto = '—'

                if (esEntregado) {
                  etiqueta = orden.fecha_bodega ? 'Entregado al cliente (previo bodega)' : 'Entregado al cliente'
                  fechaTexto = orden.fecha_ec ? new Date(orden.fecha_ec).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'
                } else if (esBodega) {
                  etiqueta = 'En bodega (listo para entrega)'
                  fechaTexto = orden.fecha_bodega ? new Date(orden.fecha_bodega).toLocaleDateString('es-EC', { dateStyle: 'short' }) : '—'
                }

                return (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${paso4Listo ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${paso4Listo ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                        {paso4Listo ? '✓' : '4'}
                      </span>
                      <span className={paso4Listo ? 'font-bold text-green-700' : 'text-gray-400'}>
                        {etiqueta}
                      </span>
                    </div>
                    <span className="text-xs text-navy-300">
                      {fechaTexto}
                    </span>
                  </div>
                )
              })()}
            </div>
          </>
        )}

        {/* Avanzar estado */}
        {rol !== 'contador' && (
          <>
            <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Avanzar estado operativo</h4>
            {orden.estado === 'Cancelada' ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Orden cancelada ✕</p>
            ) : esperandoPlanta ? (
              <p className="rounded-lg bg-amber-50 px-3 py-3 text-xs font-medium text-amber-700">
                Esta orden está en fábrica. El administrador de planta debe evaluar cada llanta y marcar el retorno de fábrica.
              </p>
            ) : orden.estado === 'Recepcion' ? (
              <button
                onClick={() => cambiarEstado('Envio a fabrica')}
                disabled={saving}
                className="w-full rounded-lg border border-primary-400 bg-primary-400 px-4 py-3 text-sm font-bold text-navy-500 hover:bg-primary-300 transition"
              >
                {saving ? 'Procesando...' : '→ Avanzar a: Envio a fabrica'}
              </button>
            ) : orden.estado === 'Retorno de fabrica' ? (
              <div className="space-y-3">
                {!orden.factura_emitida ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏳</span>
                      <span className="font-bold text-xs text-amber-800">Pendiente de Facturación</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      Las llantas retornaron de fábrica. La <strong>contadora debe generar la factura</strong> antes de que puedas enviar esta orden a Bodega o entregarla al cliente.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 border border-green-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-700">✓ Factura generada por contabilidad</span>
                        {orden.numero_factura && <span className="font-normal text-green-600">(Nº: {orden.numero_factura})</span>}
                      </div>
                      <span className="text-[11px] text-navy-300">
                        {orden.fecha_factura ? new Date(orden.fecha_factura).toLocaleDateString('es-EC', { dateStyle: 'short' }) : ''}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-navy-400">
                      Factura lista. Selecciona el siguiente paso:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Opción A: Pasar a Bodega */}
                      <button
                        onClick={() => cambiarEstado('En bodega')}
                        disabled={saving}
                        className="flex flex-col items-center justify-center rounded-xl border border-navy-200 bg-navy-50/70 p-3 text-center transition hover:bg-navy-100 hover:border-navy-300 disabled:opacity-50"
                      >
                        <span className="text-xl mb-1">📦</span>
                        <span className="text-xs font-bold text-navy-700">Pasar a Bodega</span>
                        <span className="text-[10px] text-navy-400">Almacenar temporalmente</span>
                      </button>

                      {/* Opción B: Entregar directamente al Cliente */}
                      <button
                        onClick={() => !bloqueadoPorPago && cambiarEstado('Entregado al cliente')}
                        disabled={saving || bloqueadoPorPago}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                          bloqueadoPorPago
                            ? 'border-red-200 bg-red-50/70 opacity-60 cursor-not-allowed'
                            : 'border-green-300 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        <span className="text-xl mb-1">🤝</span>
                        <span className={`text-xs font-bold ${bloqueadoPorPago ? 'text-red-500' : 'text-green-700'}`}>
                          Entregar al Cliente
                        </span>
                        <span className="text-[10px] text-navy-400">Entrega directa sin bodega</span>
                      </button>
                    </div>

                    {bloqueadoPorPago && (
                      <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                        Para entregar directamente al cliente el pago debe estar completado. Pendiente: ${orden.monto_pendiente.toFixed(2)} (Puedes pasar la orden a Bodega mientras se realiza el cobro).
                      </p>
                    )}
                    {puedeEntregar && (orden.tipo_pago === 'Cheque' || orden.tipo_pago === 'Transferencia') && (
                      <p className="mt-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                        Pago verificado ({orden.tipo_pago}). Listo para entregar directamente al cliente.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : orden.estado === 'En bodega' ? (
              <div>
                <p className="mb-2 text-xs font-medium text-navy-400">
                  La orden está en bodega. Puedes proceder a entregarla al cliente:
                </p>
                <button
                  onClick={() => !bloqueadoPorPago && cambiarEstado('Entregado al cliente')}
                  disabled={saving || bloqueadoPorPago}
                  className={`w-full rounded-lg border px-4 py-3 text-sm font-bold transition ${
                    bloqueadoPorPago
                      ? 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed'
                      : 'border-green-400 bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {saving ? 'Procesando...' : '🤝 Entregar al Cliente'}
                </button>
                {bloqueadoPorPago && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    No se puede entregar: el pago no está completado. Pendiente: ${orden.monto_pendiente.toFixed(2)}
                  </p>
                )}
                {puedeEntregar && (orden.tipo_pago === 'Cheque' || orden.tipo_pago === 'Transferencia') && (
                  <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                    Pago verificado ({orden.tipo_pago}). Listo para entregar.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-600">Orden completada ✓</p>
            )}
          </>
        )}

        {/* Módulo de Facturación (Para Contadora o Jefe) */}
        {(rol === 'contador' || rol === 'jefe') && (
          <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-orange-700">Módulo de Facturación</h4>
              {orden.factura_emitida ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Facturada ✓</span>
              ) : (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Por Facturar</span>
              )}
            </div>

            {orden.factura_emitida ? (
              <div className="rounded-lg bg-white p-3 border border-green-200 text-xs space-y-1">
                <p className="font-bold text-green-700">✓ Factura emitida exitosamente</p>
                {orden.numero_factura && <p className="text-navy-400">Nº Factura: <span className="font-semibold text-navy-500">{orden.numero_factura}</span></p>}
                {orden.fecha_factura && <p className="text-[11px] text-navy-300">Fecha: {new Date(orden.fecha_factura).toLocaleString('es-EC')}</p>}
              </div>
            ) : orden.estado === 'Retorno de fabrica' ? (
              <div className="space-y-3">
                <p className="text-xs text-orange-950 font-medium">
                  Las llantas están listas en retorno de fábrica. Genera la factura para habilitar que el vendedor pueda enviarla a Bodega o entregarla al cliente:
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-orange-900 mb-1">Número de Factura (opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej: 001-002-000012345"
                    value={numeroFacturaInput}
                    onChange={e => setNumeroFacturaInput(e.target.value)}
                    className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-navy-500 placeholder:text-navy-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <button
                  onClick={generarFactura}
                  disabled={saving || generandoFactura}
                  className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 shadow-sm"
                >
                  {generandoFactura ? 'Generando Factura...' : '🧾 Generar Factura (Habilitar Bodega / Entrega)'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-navy-400">
                La facturación se habilita cuando la orden retorna de fábrica. (Estado actual: <strong>{orden.estado}</strong>)
              </p>
            )}
          </div>
        )}

        {/* Items */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Items ({orden.items.length})</h4>
        {orden.items.map((it, i) => {
          const subtotal = it.cantidad * it.valor_unitario
          const evaluacionesItem = evaluaciones.filter(item => item.item_id === it.id)
          return (
            <div key={i} className="flex items-center justify-between border-b border-navy-50 py-2">
              <div>
                <span className="text-sm text-navy-500">{it.cantidad}x {it.marca || 'Sin marca'} — {it.media || 'S/M'}</span>
                {it.rechazo && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RECHAZO (no se cobra)</span>}
                {evaluacionesItem.length > 0 && <div className="mt-1 space-y-0.5">{evaluacionesItem.map(evaluacion => <p key={evaluacion.id} className={`text-xs font-semibold ${evaluacion.estado === 'valida' ? 'text-green-600' : 'text-red-600'}`}>Planta llanta {evaluacion.numero_llanta}: {evaluacion.estado === 'valida' ? 'Valió / realizada' : 'No valió'}{evaluacion.observaciones ? ` · ${evaluacion.observaciones}` : ''}</p>)}</div>}
              </div>
              <span className={`text-sm font-bold ${it.rechazo ? 'text-red-300 line-through' : 'text-navy-500'}`}>${subtotal.toFixed(2)}</span>
            </div>
          )
        })}

        {/* Exportar Nota de Entrega */}
        <div className="mt-4">
          <button onClick={() => {
            setSaving(true); setMsg(null);
            reporteService.exportarNotaEntrega(orden)
              .then(() => { setMsgType('success'); setMsg('✓ Nota de entrega generada'); })
              .catch(e => { setMsgType('error'); setMsg(e instanceof Error ? e.message : 'Error al exportar'); })
              .finally(() => setSaving(false));
          }} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-navy-500 bg-white px-4 py-2.5 text-sm font-bold text-navy-500 transition hover:bg-navy-50 disabled:opacity-60">
            Exportar Nota de Entrega (Excel)
          </button>
        </div>

        {/* Pago */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Control de Pago</h4>
        <div className="rounded-lg bg-navy-50 p-4">
          <PagoRow label="Subtotal (Sin IVA)" value={orden.monto_total / 1.15} color="text-navy-400" />
          <PagoRow label="IVA (15%)" value={orden.monto_total - (orden.monto_total / 1.15)} color="text-navy-400" />
          <div className="my-2 border-b border-navy-100" />
          <PagoRow label="Total a Facturar" value={orden.monto_total} color="text-navy-500" />
          <PagoRow label="Abonado" value={orden.monto_abonado} color="text-green-600" />
          <PagoRow label="Pendiente" value={orden.monto_pendiente} color={orden.monto_pendiente > 0 ? 'text-red-500' : 'text-green-600'} />
        </div>

        {/* Tipo de pago + calendario de credito */}
        <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-300">Tipo de pago</label>
        <select value={tipoPago} onChange={e => onTipoPagoChange(e.target.value)} disabled={!!orden.tipo_pago}
          className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-navy-50 disabled:text-navy-400 disabled:cursor-not-allowed">
          <option value="">Sin definir</option>
          {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Preview de fecha de vencimiento */}
        {fechaVencPreview && (
          <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3">
            <div className="flex items-center gap-2">
              <CalendarIcon />
              <div>
                <p className="text-xs font-bold text-navy-500">
                  Vencimiento del credito: {new Date(fechaVencPreview).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="mt-0.5 text-[11px] text-navy-300">
                  {diasDeCredito(tipoPago)} dias corridos
                </p>
              </div>
            </div>
          </div>
        )}

        {!orden.tipo_pago && (
          <button onClick={definirPago} disabled={saving || !tipoPago}
            className="mt-2 w-full rounded-lg bg-navy-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-navy-600 disabled:opacity-60">
            Definir tipo de pago
          </button>
        )}

        {/* Abono */}
        <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-primary-600">Registrar abono</h4>

        {/* Historial de abonos */}
        {loadingAbonos ? (
          <p className="mb-3 text-xs text-navy-200">Cargando historial...</p>
        ) : historialAbonos.length > 0 ? (
          <div className="mb-3 rounded-xl border border-navy-100 bg-navy-50 overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-navy-300">Historial de abonos ({historialAbonos.length})</p>
            <div className="divide-y divide-navy-100">
              {historialAbonos.map((a, i) => (
                <div key={a.id || i} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-green-600">+${Number(a.monto).toFixed(2)}</p>
                    {a.descripcion && <p className="text-[10px] text-navy-300">{a.descripcion}</p>}
                  </div>
                  <p className="text-[11px] text-navy-300">
                    {a.fecha
                      ? new Date(a.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'
                    }
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-navy-100 bg-white px-3 py-2">
              <span className="text-xs font-bold text-navy-400">Total abonado:</span>
              <span className="text-xs font-bold text-green-600">${historialAbonos.reduce((s, a) => s + Number(a.monto), 0).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="mb-3 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-300">Sin abonos registrados aún.</p>
        )}

        {/* Campo y botón de nuevo abono */}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              step="0.01"
              min="0"
              value={abonoMonto}
              onChange={e => setAbonoMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-500 placeholder:text-navy-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <button onClick={registrarAbono} disabled={saving || !abonoMonto}
            className="shrink-0 rounded-lg bg-primary-400 px-4 py-2.5 text-sm font-bold text-navy-500 transition hover:bg-primary-300 disabled:opacity-60">
            {saving ? '...' : '+ Abonar'}
          </button>
        </div>

        {orden.activo_vigente && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-600">
            ✓ Orden activa / vigente (pagada completa)
          </div>
        )}
      </div>
    </div>
  )
}
