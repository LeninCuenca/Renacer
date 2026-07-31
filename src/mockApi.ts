/**
 * mockApi.ts — Capa de datos en memoria que replica el backend FastAPI.
 */

import type { Cliente, Orden, Item, EstadoOrden, TipoPago, ResumenReporte } from './types'
import { ESTADOS, calcularFechaVencimiento, diasDeCredito } from './types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// ============================================================
// Estado en memoria
// ============================================================
let clientes: Cliente[] = [
  { id: 1, nombre: 'Juan Perez', cedula: '1711111111', telefono: '0991234567', direccion: 'Azuay', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 2, nombre: 'Maria Gonzalez', cedula: '1722222222', telefono: '0987654321', direccion: 'Loja', created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 3, nombre: 'Carlos Mendoza', cedula: '1733333333', telefono: '0971122334', direccion: 'Zumbi', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
]

let ordenes: Orden[] = [
  {
    id: 1, numero: 'OT-0001', cliente_id: 1, cliente_nombre: 'Juan Perez',
    estado: 'Retorno de fabrica',
    fecha_rc: new Date(Date.now() - 86400000 * 10).toISOString(),
    fecha_ef: new Date(Date.now() - 86400000 * 8).toISOString(),
    fecha_rf: new Date(Date.now() - 86400000 * 3).toISOString(),
    fecha_bodega: null, fecha_ec: null,
    tipo_pago: 'Credito 30 dias',
    fecha_vencimiento: calcularFechaVencimiento(new Date(), 30).toISOString(),
    monto_total: 100.0, monto_abonado: 100.0, monto_pendiente: 0.0,
    pagado_completo: true, activo_vigente: true,
    observaciones: 'Cliente frecuente',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    items: [
      { id: 1, orden_id: 1, marca: 'Michelin', n_serie: 'SN001', media: 'R14', diseno: 'Rayado', cantidad: 2, valor_unitario: 50.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 10).toISOString() },
      { id: 2, orden_id: 1, marca: 'Pirelli', n_serie: 'SN002', media: 'R15', diseno: 'Cuadros', cantidad: 1, valor_unitario: 80.0, rechazo: true, observaciones: 'Defecto de fabrica', fecha_ingreso: new Date(Date.now() - 86400000 * 10).toISOString() },
    ],
  },
  {
    id: 2, numero: 'OT-0002', cliente_id: 2, cliente_nombre: 'Maria Gonzalez',
    estado: 'Entregado al cliente',
    fecha_rc: new Date(Date.now() - 86400000 * 20).toISOString(),
    fecha_ef: new Date(Date.now() - 86400000 * 18).toISOString(),
    fecha_rf: new Date(Date.now() - 86400000 * 12).toISOString(),
    fecha_bodega: new Date(Date.now() - 86400000 * 7).toISOString(),
    fecha_ec: new Date(Date.now() - 86400000 * 5).toISOString(),
    tipo_pago: 'Contado',
    fecha_vencimiento: null,
    monto_total: 90.0, monto_abonado: 90.0, monto_pendiente: 0.0,
    pagado_completo: true, activo_vigente: true,
    observaciones: '',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    items: [
      { id: 3, orden_id: 2, marca: 'Goodyear', n_serie: 'SN003', media: 'R13', diseno: 'Liso', cantidad: 2, valor_unitario: 45.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 20).toISOString() },
    ],
  },
  {
    id: 3, numero: 'OT-0003', cliente_id: 3, cliente_nombre: 'Carlos Mendoza',
    estado: 'Recepcion',
    fecha_rc: new Date(Date.now() - 86400000 * 1).toISOString(),
    fecha_ef: null, fecha_rf: null, fecha_bodega: null, fecha_ec: null,
    tipo_pago: null,
    fecha_vencimiento: null,
    monto_total: 120.0, monto_abonado: 0.0, monto_pendiente: 120.0,
    pagado_completo: false, activo_vigente: false,
    observaciones: 'Urgente',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    items: [
      { id: 4, orden_id: 3, marca: 'Bridgestone', n_serie: 'SN004', media: 'R16', diseno: 'Mixto', cantidad: 1, valor_unitario: 120.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 1).toISOString() },
    ],
  },
]

let nextClienteId = 4
let nextOrdenId = 4
let nextItemId = 5

interface Abono {
  id: number
  orden_id: number
  monto: number
  fecha: string
  descripcion?: string | null
}

let abonos: Abono[] = [
  { id: 1, orden_id: 1, monto: 100.0, fecha: new Date(Date.now() - 86400000 * 5).toISOString(), descripcion: 'Abono inicial' },
  { id: 2, orden_id: 2, monto: 90.0, fecha: new Date(Date.now() - 86400000 * 5).toISOString(), descripcion: 'Pago al contado' },
]
let nextAbonoId = 3

// ============================================================
// Helpers
// ============================================================

/** Recalcula montos excluyendo items rechazados */
function recalcular(orden: Orden): void {
  const itemsValidos = orden.items.filter(it => !it.rechazo)
  orden.monto_total = Math.round(itemsValidos.reduce((s, it) => s + it.cantidad * it.valor_unitario, 0) * 100) / 100
  const totalAbonos = abonos.filter(a => a.orden_id === orden.id).reduce((s, a) => s + a.monto, 0)
  orden.monto_abonado = Math.round(totalAbonos * 100) / 100
  orden.monto_pendiente = Math.round((orden.monto_total - totalAbonos) * 100) / 100
  orden.pagado_completo = orden.monto_pendiente <= 0 && orden.monto_total > 0
  orden.activo_vigente = orden.pagado_completo
}

/** Diferencia en dias enteros entre dos fechas (sin decimales) */
function diffDias(a?: string | null, b?: string | null): number | null {
  if (a && b) {
    const ms = new Date(b).getTime() - new Date(a).getTime()
    return Math.round(ms / 86400000)
  }
  return null
}

/** Valida la trazabilidad secuencial */
function validarTransicion(orden: Orden, nuevoEstado: EstadoOrden): void {
  const idxActual = ESTADOS.indexOf(orden.estado)
  const idxNuevo = ESTADOS.indexOf(nuevoEstado)
  if (idxNuevo <= idxActual) {
    throw new Error('No se puede retroceder en la trazabilidad. El estado debe avanzar secuencialmente.')
  }
  if (idxNuevo !== idxActual + 1) {
    throw new Error(`Debe avanzar al estado siguiente: "${ESTADOS[idxActual + 1]}". No puede saltar pasos.`)
  }
}

/** Verifica pago completado antes de entrega */
function verificarEntrega(orden: Orden): void {
  if (!orden.pagado_completo) {
    throw new Error('No se puede entregar la orden: el pago no esta completado. Registre el abono pendiente primero.')
  }
}

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), 200))
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ============================================================
// API publica
// ============================================================
export const mockApi = {
  // --- Clientes ---
  async getClientes(): Promise<Cliente[]> {
    return delay([...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  },

  async createCliente(data: { nombre: string; cedula: string; telefono?: string | null; direccion?: string | null }): Promise<Cliente> {
    if (clientes.some(c => c.cedula === data.cedula)) {
      throw new Error('Ya existe un cliente con esa cedula')
    }
    const cli: Cliente = {
      id: nextClienteId++,
      nombre: data.nombre,
      cedula: data.cedula,
      telefono: data.telefono || null,
      direccion: data.direccion || null,
      created_at: new Date().toISOString(),
    }
    clientes.push(cli)
    return delay(cli)
  },

  // --- Ordenes ---
  async getOrdenes(): Promise<Orden[]> {
    return delay(JSON.parse(JSON.stringify(ordenes)))
  },

  async getOrden(id: number): Promise<Orden> {
    const o = ordenes.find(x => x.id === id)
    if (!o) throw new Error('Orden no encontrada')
    return delay(JSON.parse(JSON.stringify(o)))
  },

  async createOrden(data: {
    numero: string
    cliente_id: number
    observaciones?: string
    items: Omit<Item, 'id' | 'orden_id' | 'fecha_ingreso'>[]
  }): Promise<Orden> {
    const cli = clientes.find(c => c.id === data.cliente_id)
    if (!cli) throw new Error('Cliente no encontrado')
    if (ordenes.some(o => o.numero === data.numero)) throw new Error('Ya existe una orden con ese numero')

    const now = new Date().toISOString()
    const orden: Orden = {
      id: nextOrdenId++,
      numero: data.numero,
      cliente_id: data.cliente_id,
      cliente_nombre: cli.nombre,
      estado: 'Recepcion',
      fecha_rc: now,
      fecha_ef: null, fecha_rf: null, fecha_bodega: null, fecha_ec: null,
      tipo_pago: null,
      fecha_vencimiento: null,
      monto_total: 0, monto_abonado: 0, monto_pendiente: 0,
      pagado_completo: false, activo_vigente: false,
      observaciones: data.observaciones || '',
      created_at: now,
      items: data.items.map(it => ({
        ...it,
        id: nextItemId++,
        orden_id: nextOrdenId - 1,
        fecha_ingreso: now,
      })),
    }
    recalcular(orden)
    ordenes.push(orden)
    return delay(JSON.parse(JSON.stringify(orden)))
  },

  async cambiarEstado(ordenId: number, estado: EstadoOrden): Promise<Orden> {
    const orden = ordenes.find(o => o.id === ordenId)
    if (!orden) throw new Error('Orden no encontrada')
    validarTransicion(orden, estado)
    if (estado === 'Entregado al cliente') {
      verificarEntrega(orden)
    }
    const now = new Date().toISOString()
    orden.estado = estado
    if (estado === 'Recepcion') orden.fecha_rc = now
    else if (estado === 'Envio a fabrica') orden.fecha_ef = now
    else if (estado === 'Retorno de fabrica') orden.fecha_rf = now
    else if (estado === 'En bodega') orden.fecha_bodega = now
    else if (estado === 'Entregado al cliente') orden.fecha_ec = now
    return delay(JSON.parse(JSON.stringify(orden)))
  },

  async definirPago(ordenId: number, tipoPago: TipoPago): Promise<Orden> {
    const orden = ordenes.find(o => o.id === ordenId)
    if (!orden) throw new Error('Orden no encontrada')
    orden.tipo_pago = tipoPago
    // Calcular fecha de vencimiento si es credito
    const dias = diasDeCredito(tipoPago)
    if (dias > 0) {
      orden.fecha_vencimiento = calcularFechaVencimiento(new Date(), dias).toISOString()
    } else {
      orden.fecha_vencimiento = null
    }
    return delay(JSON.parse(JSON.stringify(orden)))
  },

  async registrarAbono(ordenId: number, monto: number, descripcion?: string): Promise<Abono> {
    const orden = ordenes.find(o => o.id === ordenId)
    if (!orden) throw new Error('Orden no encontrada')
    const abono: Abono = {
      id: nextAbonoId++,
      orden_id: ordenId,
      monto,
      fecha: new Date().toISOString(),
      descripcion: descripcion || null,
    }
    abonos.push(abono)
    recalcular(orden)
    return delay(abono)
  },

  async getAbonos(ordenId: number): Promise<Abono[]> {
    return delay(abonos.filter(a => a.orden_id === ordenId).sort((a, b) => b.fecha.localeCompare(a.fecha)))
  },

  // --- Reportes ---
  async getResumen(anio: number, mes: number): Promise<ResumenReporte> {
    const inicio = new Date(anio, mes - 1, 1)
    const fin = new Date(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1)
    const filtradas = ordenes.filter(o => {
      const c = new Date(o.created_at || o.fecha_rc || '')
      return c >= inicio && c < fin
    })

    const rcRf = filtradas.map(o => diffDias(o.fecha_rc, o.fecha_rf)).filter((v): v is number => v != null)
    const efRf = filtradas.map(o => diffDias(o.fecha_ef, o.fecha_rf)).filter((v): v is number => v != null)
    const rcEc = filtradas.map(o => diffDias(o.fecha_rc, o.fecha_ec)).filter((v): v is number => v != null)

    return delay({
      anio, mes,
      total_ordenes: filtradas.length,
      total_cantidad: filtradas.reduce((s, o) => s + o.items.filter(it => !it.rechazo).reduce((si, it) => si + it.cantidad, 0), 0),
      promedio_rc_rf_dias: rcRf.length ? Math.round(rcRf.reduce((a, b) => a + b, 0) / rcRf.length) : null,
      promedio_ef_rf_dias: efRf.length ? Math.round(efRf.reduce((a, b) => a + b, 0) / efRf.length) : null,
      promedio_rc_ec_dias: rcEc.length ? Math.round(rcEc.reduce((a, b) => a + b, 0) / rcEc.length) : null,
    })
  },

  /** Exporta un archivo Excel (.xls) real con formato de tabla, agrupado por cliente */
  async downloadExcel(anio: number, mes: number): Promise<void> {
    const inicio = new Date(anio, mes - 1, 1)
    const fin = new Date(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1)
    const filtradas = ordenes.filter(o => {
      const c = new Date(o.created_at || o.fecha_rc || '')
      return c >= inicio && c < fin
    })

    const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''
    const diff = (a?: string | null, b?: string | null) => {
      const v = diffDias(a, b)
      return v != null ? String(v) : ''
    }

    // Agrupar por cliente
    const porCliente = new Map<number, Orden[]>()
    for (const o of filtradas) {
      const arr = porCliente.get(o.cliente_id) || []
      arr.push(o)
      porCliente.set(o.cliente_id, arr)
    }

    let body = ''

    // Estilos
    const thStyle = 'background:#1e3a5f;color:white;font-weight:bold;border:1px solid #1e3a5f;padding:4px 8px;text-align:center;font-size:11px;'
    const tdStyle = 'border:1px solid #ccc;padding:4px 8px;font-size:11px;'
    const tdNum = 'border:1px solid #ccc;padding:4px 8px;font-size:11px;text-align:right;'
    const totalStyle = 'border:1px solid #ccc;padding:4px 8px;font-size:11px;font-weight:bold;background:#e8f0fe;'
    const totalNum = 'border:1px solid #ccc;padding:4px 8px;font-size:11px;font-weight:bold;background:#e8f0fe;text-align:right;'
    const titleStyle = 'font-size:16px;font-weight:bold;color:#1e3a5f;padding:8px 0;'
    const subtitleStyle = 'font-size:12px;color:#666;padding:2px 0 8px;'

    body += `<tr><td colspan="14" style="${titleStyle}">Reporte Renacer - ${String(mes).padStart(2, '0')}/${anio}</td></tr>`
    body += `<tr><td colspan="14" style="${subtitleStyle}">Tiempos expresados en dias naturales (enteros)</td></tr>`
    body += '<tr><td colspan="14"></td></tr>'

    for (const [cliId, ords] of porCliente) {
      const cli = clientes.find(c => c.id === cliId)
      const cliNombre = cli?.nombre || 'Desconocido'
      const cliDir = cli?.direccion || ''
      const dirText = cliDir ? ` — Direccion: ${cliDir}` : ''

      body += `<tr><td colspan="14" style="font-size:13px;font-weight:bold;color:#1e3a5f;padding:6px 0 2px;">CLIENTE: ${escapeXml(cliNombre)}${escapeXml(dirText)}</td></tr>`

      // Encabezado de tabla
      const headers = ['Cliente', 'N° Orden', 'Cant. (valida)', 'Recepcion (RC)', 'Envio (EF)', 'Retorno (RF)', 'Entrega (EC)', 'Dias RC-RF', 'Dias EF-RF', 'Dias RC-EC', 'Total', 'Abonado', 'Pendiente', 'Estado']
      body += '<tr>' + headers.map(h => `<td style="${thStyle}">${h}</td>`).join('') + '</tr>'

      let totCant = 0, totTotal = 0, totAbonado = 0, totPendiente = 0
      const rcRfVals: number[] = [], efRfVals: number[] = [], rcEcVals: number[] = []

      for (const o of ords) {
        const cantValida = o.items.filter(it => !it.rechazo).reduce((s, it) => s + it.cantidad, 0)
        totCant += cantValida
        totTotal += o.monto_total
        totAbonado += o.monto_abonado
        totPendiente += o.monto_pendiente

        const dRcRf = diffDias(o.fecha_rc, o.fecha_rf); if (dRcRf != null) rcRfVals.push(dRcRf)
        const dEfRf = diffDias(o.fecha_ef, o.fecha_rf); if (dEfRf != null) efRfVals.push(dEfRf)
        const dRcEc = diffDias(o.fecha_rc, o.fecha_ec); if (dRcEc != null) rcEcVals.push(dRcEc)

        body += '<tr>' + [
          escapeXml(cliNombre), escapeXml(o.numero), String(cantValida),
          fmt(o.fecha_rc), fmt(o.fecha_ef), fmt(o.fecha_rf), fmt(o.fecha_ec),
          diff(o.fecha_rc, o.fecha_rf), diff(o.fecha_ef, o.fecha_rf), diff(o.fecha_rc, o.fecha_ec),
          o.monto_total.toFixed(2), o.monto_abonado.toFixed(2), o.monto_pendiente.toFixed(2),
          escapeXml(o.estado),
        ].map((c, i) => {
          const isNum = i >= 2 && i <= 9 || i >= 10 && i <= 12
          return `<td style="${isNum ? tdNum : tdStyle}">${c}</td>`
        }).join('') + '</tr>'
      }

      // Fila totales del cliente
      body += '<tr>' + [
        `TOTAL ${cliNombre}`, '', String(totCant), '', '', '', '',
        rcRfVals.length ? String(Math.round(rcRfVals.reduce((a, b) => a + b, 0) / rcRfVals.length)) : '',
        efRfVals.length ? String(Math.round(efRfVals.reduce((a, b) => a + b, 0) / efRfVals.length)) : '',
        rcEcVals.length ? String(Math.round(rcEcVals.reduce((a, b) => a + b, 0) / rcEcVals.length)) : '',
        totTotal.toFixed(2), totAbonado.toFixed(2), totPendiente.toFixed(2), '',
      ].map((c, i) => {
        const isNum = i >= 2 && i <= 9 || i >= 10 && i <= 12
        return `<td style="${isNum ? totalNum : totalStyle}">${c}</td>`
      }).join('') + '</tr>'

      body += '<tr><td colspan="14" style="height:12px;"></td></tr>'
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reporte</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1">${body}</table></body></html>`

    const fileName = `reporte_renacer_${anio}_${String(mes).padStart(2, '0')}.xls`

    if (Capacitor.isNativePlatform()) {
      const base64Data = window.btoa(unescape(encodeURIComponent('\ufeff' + html)));
      const chunkSize = 32768; // 32KB
      let savedFile: any = null;

      for (let i = 0; i < base64Data.length; i += chunkSize) {
        const chunk = base64Data.substring(i, i + chunkSize);
        if (i === 0) {
          savedFile = await Filesystem.writeFile({
            path: fileName,
            data: chunk,
            directory: Directory.Cache
          });
        } else {
          await Filesystem.appendFile({
            path: fileName,
            data: chunk,
            directory: Directory.Cache
          });
        }
      }

      await Share.share({
        title: 'Reporte Mensual Renacer',
        url: savedFile.uri,
        dialogTitle: 'Compartir o guardar Excel'
      });
    } else {
      const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  },

  // --- Alertas de credito por vencer ---
  async getCreditosPorVencer(): Promise<Array<{ orden: Orden; diasRestantes: number; porVencer: boolean; vencido: boolean }>> {
    const ahora = new Date()
    const result: Array<{ orden: Orden; diasRestantes: number; porVencer: boolean; vencido: boolean }> = []
    for (const o of ordenes) {
      if (!o.fecha_vencimiento) continue
      if (o.pagado_completo) continue
      const venc = new Date(o.fecha_vencimiento)
      const diffMs = venc.getTime() - ahora.getTime()
      const dias = Math.ceil(diffMs / 86400000)
      result.push({
        orden: JSON.parse(JSON.stringify(o)),
        diasRestantes: dias,
        porVencer: dias >= 0 && dias <= 7,
        vencido: dias < 0,
      })
    }
    return delay(result.sort((a, b) => a.diasRestantes - b.diasRestantes))
  },
}
