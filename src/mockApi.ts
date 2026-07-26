/**
 * mockApi.ts — Capa de datos en memoria que replica exactamente el backend
 * FastAPI. Permite que la app web funcione de forma independiente en el
 * navegador sin necesidad del servidor Python. En produccion, simplemente
 * se reemplaza por llamadas fetch al backend.
 */

import type { Cliente, Orden, Item, EstadoOrden, TipoPago, ResumenReporte } from './types'

// ============================================================
// Estado en memoria
// ============================================================
let clientes: Cliente[] = [
  { id: 1, nombre: 'Juan Perez', cedula: '1711111111', telefono: '0991234567', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 2, nombre: 'Maria Gonzalez', cedula: '1722222222', telefono: '0987654321', created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 3, nombre: 'Carlos Mendoza', cedula: '1733333333', telefono: '0971122334', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
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
    monto_total: 180.0, monto_abonado: 100.0, monto_pendiente: 80.0,
    pagado_completo: false, activo_vigente: false,
    observaciones: 'Cliente frecuente',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    items: [
      { id: 1, orden_id: 1, marca: 'Michelin', n_serie: 'SN001', media: '14', diseno: 'Rayado', cantidad: 2, valor_unitario: 50.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 10).toISOString() },
      { id: 2, orden_id: 1, marca: 'Pirelli', n_serie: 'SN002', media: '15', diseno: 'Cuadros', cantidad: 1, valor_unitario: 80.0, rechazo: true, observaciones: 'Defecto de fabrica', fecha_ingreso: new Date(Date.now() - 86400000 * 10).toISOString() },
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
    monto_total: 90.0, monto_abonado: 90.0, monto_pendiente: 0.0,
    pagado_completo: true, activo_vigente: true,
    observaciones: '',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    items: [
      { id: 3, orden_id: 2, marca: 'Goodyear', n_serie: 'SN003', media: '13', diseno: 'Liso', cantidad: 2, valor_unitario: 45.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 20).toISOString() },
    ],
  },
  {
    id: 3, numero: 'OT-0003', cliente_id: 3, cliente_nombre: 'Carlos Mendoza',
    estado: 'Recepcion',
    fecha_rc: new Date(Date.now() - 86400000 * 1).toISOString(),
    fecha_ef: null, fecha_rf: null, fecha_bodega: null, fecha_ec: null,
    tipo_pago: null,
    monto_total: 120.0, monto_abonado: 0.0, monto_pendiente: 120.0,
    pagado_completo: false, activo_vigente: false,
    observaciones: 'Urgente',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    items: [
      { id: 4, orden_id: 3, marca: 'Bridgestone', n_serie: 'SN004', media: '16', diseno: 'Mixto', cantidad: 1, valor_unitario: 120.0, rechazo: false, observaciones: '', fecha_ingreso: new Date(Date.now() - 86400000 * 1).toISOString() },
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
function recalcular(orden: Orden): void {
  orden.monto_total = Math.round(orden.items.reduce((s, it) => s + it.cantidad * it.valor_unitario, 0) * 100) / 100
  const totalAbonos = abonos.filter(a => a.orden_id === orden.id).reduce((s, a) => s + a.monto, 0)
  orden.monto_abonado = Math.round(totalAbonos * 100) / 100
  orden.monto_pendiente = Math.round((orden.monto_total - totalAbonos) * 100) / 100
  orden.pagado_completo = orden.monto_pendiente <= 0
  orden.activo_vigente = orden.pagado_completo
}

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), 200))
}

// ============================================================
// API publica (mismas firmas que el backend real)
// ============================================================
export const mockApi = {
  // --- Clientes ---
  async getClientes(): Promise<Cliente[]> {
    return delay([...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  },

  async createCliente(data: { nombre: string; cedula: string; telefono?: string | null }): Promise<Cliente> {
    if (clientes.some(c => c.cedula === data.cedula)) {
      throw new Error('Ya existe un cliente con esa cedula')
    }
    const cli: Cliente = {
      id: nextClienteId++,
      nombre: data.nombre,
      cedula: data.cedula,
      telefono: data.telefono || null,
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

  async addItem(ordenId: number, data: Omit<Item, 'id' | 'orden_id' | 'fecha_ingreso'>): Promise<Orden> {
    const orden = ordenes.find(o => o.id === ordenId)
    if (!orden) throw new Error('Orden no encontrada')
    const item: Item = {
      ...data,
      id: nextItemId++,
      orden_id: ordenId,
      fecha_ingreso: new Date().toISOString(),
    }
    orden.items.push(item)
    recalcular(orden)
    return delay(JSON.parse(JSON.stringify(orden)))
  },

  async cambiarEstado(ordenId: number, estado: EstadoOrden): Promise<Orden> {
    const orden = ordenes.find(o => o.id === ordenId)
    if (!orden) throw new Error('Orden no encontrada')
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

    const diffHoras = (a?: string | null, b?: string | null): number | null => {
      if (a && b) return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 3600000 * 10) / 10
      return null
    }

    const rcRf = filtradas.map(o => diffHoras(o.fecha_rc, o.fecha_rf)).filter((v): v is number => v != null)
    const efRf = filtradas.map(o => diffHoras(o.fecha_ef, o.fecha_rf)).filter((v): v is number => v != null)
    const rcEc = filtradas.map(o => diffHoras(o.fecha_rc, o.fecha_ec)).filter((v): v is number => v != null)

    return delay({
      anio, mes,
      total_ordenes: filtradas.length,
      total_cantidad: filtradas.reduce((s, o) => s + o.items.reduce((si, it) => si + it.cantidad, 0), 0),
      promedio_rc_rf_horas: rcRf.length ? Math.round(rcRf.reduce((a, b) => a + b, 0) / rcRf.length * 10) / 10 : null,
      promedio_ef_rf_horas: efRf.length ? Math.round(efRf.reduce((a, b) => a + b, 0) / efRf.length * 10) / 10 : null,
      promedio_rc_ec_horas: rcEc.length ? Math.round(rcEc.reduce((a, b) => a + b, 0) / rcEc.length * 10) / 10 : null,
    })
  },

  // Excel: en modo web, generamos un CSV descargable
  async downloadExcel(anio: number, mes: number): Promise<void> {
    const inicio = new Date(anio, mes - 1, 1)
    const fin = new Date(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1)
    const filtradas = ordenes.filter(o => {
      const c = new Date(o.created_at || o.fecha_rc || '')
      return c >= inicio && c < fin
    })

    const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : ''
    const diff = (a?: string | null, b?: string | null) => {
      if (a && b) return String(Math.round((new Date(b).getTime() - new Date(a).getTime()) / 3600000 * 10) / 10)
      return ''
    }

    const headers = ['Cantidad', 'Cliente', 'Numero de orden', 'Recepcion de carcasa (RC)', 'Envio a fabrica (EF)', 'Retorno de fabrica (RF)', 'Entrega cliente (EC)', 'Promedio RC-RF (horas)', 'Promedio EF-RF (horas)', 'Promedio RC-EC (horas)', 'Observaciones']
    const rows = filtradas.map(o => [
      o.items.reduce((s, it) => s + it.cantidad, 0),
      o.cliente_nombre || '',
      o.numero,
      fmt(o.fecha_rc), fmt(o.fecha_ef), fmt(o.fecha_rf), fmt(o.fecha_ec),
      diff(o.fecha_rc, o.fecha_rf),
      diff(o.fecha_ef, o.fecha_rf),
      diff(o.fecha_rc, o.fecha_ec),
      '',
    ])

    // Fila total
    const rcRf = rows.map(r => Number(r[7])).filter(v => !isNaN(v) && v !== 0)
    const efRf = rows.map(r => Number(r[8])).filter(v => !isNaN(v) && v !== 0)
    const rcEc = rows.map(r => Number(r[9])).filter(v => !isNaN(v) && v !== 0)
    rows.push([
      rows.reduce((s, r) => s + Number(r[0]), 0),
      'TOTAL', '', '', '', '', '',
      rcRf.length ? String(Math.round(rcRf.reduce((a, b) => a + b, 0) / rcRf.length * 10) / 10) : '',
      efRf.length ? String(Math.round(efRf.reduce((a, b) => a + b, 0) / efRf.length * 10) / 10) : '',
      rcEc.length ? String(Math.round(rcEc.reduce((a, b) => a + b, 0) / rcEc.length * 10) / 10) : '',
      '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_renacer_${anio}_${String(mes).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
